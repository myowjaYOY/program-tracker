'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogContent,
  CircularProgress,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Block as CancelIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import { usePayments, usePaymentMetrics } from '@/lib/hooks/use-payments';
import { useProgramStatus } from '@/lib/hooks/use-program-status';
import { useMemberPrograms } from '@/lib/hooks/use-member-programs';
import BaseDataTable, {
  commonColumns,
  renderDate,
  renderCurrency,
} from '@/components/tables/base-data-table';
import { GridColDef } from '@mui/x-data-grid';
import LatePaymentsHoverTooltip from '@/components/payments/late-payments-hover-tooltip';
import CancelledPaymentsHoverTooltip from '@/components/payments/cancelled-payments-hover-tooltip';
import MemberProgramPaymentForm from '@/components/forms/member-program-payment-form';
import { MemberProgramPayments } from '@/types/database.types';

interface PaymentRow extends MemberProgramPayments {
  id: number;
  member_name?: string;
  program_name?: string;
}

export default function PaymentsPage() {
  const [memberFilter, setMemberFilter] = useState<number | null>(null);
  const [showAllPayments, setShowAllPayments] = useState<boolean>(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: metrics, isLoading: metricsLoading } = usePaymentMetrics();

  // Format date range for cancelled payments card
  const formatDateRange = (startDate: string | null, endDate: string | null): string => {
    if (!startDate || !endDate) return 'No cancelled payments';
    
    const formatDate = (dateStr: string): string => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };
    
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    
    return start === end ? start : `Spanning ${start} – ${end}`;
  };

  const {
    data: payments = [],
    isLoading: paymentsLoading,
    refetch,
  } = usePayments({
    memberId: memberFilter,
    showAllPayments,
  });
  const { data: programStatuses = [] } = useProgramStatus();
  const { data: allPrograms = [] } = useMemberPrograms();

  // Extract unique members (following EXACT coordinator pattern)
  const memberOptions = useMemo(() => {
    const included = new Set(['active', 'paused']);
    const filtered = (allPrograms || []).filter((p: any) =>
      included.has((p.status_name || '').toLowerCase())
    );
    const pairs = filtered
      .filter((p: any) => !!p.lead_id)
      .map((p: any) => ({
        id: p.lead_id as number,
        name: (p.lead_name as string) || `Lead #${p.lead_id}`,
      }));
    const seen = new Set<number>();
    const uniq: { id: number; name: string }[] = [];
    for (const pr of pairs) {
      if (!seen.has(pr.id)) {
        seen.add(pr.id);
        uniq.push(pr);
      }
    }
    // Sort alphabetically by name
    return uniq.sort((a, b) => a.name.localeCompare(b.name));
  }, [allPrograms]);

  const rows: PaymentRow[] = (payments || []).map((p: any) => ({
    ...p,
    id: p.member_program_payment_id,
  }));

  const columns: GridColDef[] = [
    {
      field: 'member_name',
      headerName: 'Member Name',
      width: 126,
      flex: 1,
    },
    {
      field: 'program_name',
      headerName: 'Program Name',
      width: 200,
      flex: 1,
    },
    {
      field: 'payment_due_date',
      headerName: 'Due Date',
      width: 130,
      renderCell: renderDate,
    },
    {
      field: 'payment_amount',
      headerName: 'Amount',
      width: 120,
      renderCell: renderCurrency,
    },
    {
      field: 'payment_status_name',
      headerName: 'Status',
      width: 140,
    },
    {
      field: 'notes',
      headerName: 'Notes',
      width: 240,
      flex: 1,
    },
    commonColumns.updatedAt,
    {
      field: 'updated_by',
      headerName: 'Updated By',
      width: 160,
      renderCell: (params: any) => (
        <Typography variant="body2">
          {params?.row?.updated_by_full_name || params?.row?.updated_by_email || '-'}
        </Typography>
      ),
    },
  ];

  const handleRowClick = (params: any) => {
    setEditingPayment(params.row);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setEditingPayment(null);
    refetch();
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 1 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
        >
          Payments
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Card 1: Total Amount Owed */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.info.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    Accounts Receivable
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'info.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      `$${Math.round(metrics?.totalAmountOwed || 0).toLocaleString('en-US')}`
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'info.main',
                    opacity: 0.8,
                  }}
                >
                  <MoneyIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Total receivables balance
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: Amount Paid This Month */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.primary.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    Amount Paid This Month
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'primary.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      `$${Math.round(metrics?.totalAmountDue || 0).toLocaleString('en-US')}`
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'primary.main',
                    opacity: 0.8,
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Sum of payments with paid date in current month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Total Amount Late (with hover) */}
        <Grid size={3}>
          <LatePaymentsHoverTooltip>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: theme => `4px solid ${theme.palette.error.main}`,
                transition:
                  'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme => theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography
                      color="textSecondary"
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                    >
                      Total Amount Late
                    </Typography>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{
                        fontWeight: 'bold',
                        color: 'error.main',
                        mt: 1,
                      }}
                    >
                      {metricsLoading ? (
                        <CircularProgress size={32} />
                      ) : (
                        `$${Math.round(metrics?.totalAmountLate || 0).toLocaleString('en-US')}`
                      )}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: 'error.main',
                      opacity: 0.8,
                    }}
                  >
                    <WarningIcon sx={{ fontSize: 40 }} />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Total overdue payment amount
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </LatePaymentsHoverTooltip>
        </Grid>

        {/* Card 4: Total Amount Cancelled (with hover) */}
        <Grid size={3}>
          <CancelledPaymentsHoverTooltip>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: theme => `4px solid ${theme.palette.grey[500]}`,
                transition:
                  'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme => theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography
                      color="textSecondary"
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                    >
                      Total Amount Cancelled
                    </Typography>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{
                        fontWeight: 'bold',
                        color: 'grey.600',
                        mt: 1,
                      }}
                    >
                      {metricsLoading ? (
                        <CircularProgress size={32} />
                      ) : (
                        `$${Math.round(metrics?.totalAmountCancelled || 0).toLocaleString('en-US')}`
                      )}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: 'grey.500',
                      opacity: 0.8,
                    }}
                  >
                    <CancelIcon sx={{ fontSize: 40 }} />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    {formatDateRange(
                      metrics?.cancelledDateRangeStart ?? null,
                      metrics?.cancelledDateRangeEnd ?? null
                    )}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </CancelledPaymentsHoverTooltip>
        </Grid>
      </Grid>

      {/* Filters and Data Grid */}
      <Card>
        <CardContent>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
            <TextField
              select
              label="Member"
              value={memberFilter ?? ''}
              onChange={e =>
                setMemberFilter(e.target.value ? Number(e.target.value) : null)
              }
              size="small"
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">All Members</MenuItem>
              {memberOptions.map(m => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                </MenuItem>
              ))}
            </TextField>

            <FormControlLabel
              control={
                <Checkbox
                  checked={showAllPayments}
                  onChange={e => setShowAllPayments(e.target.checked)}
                  size="small"
                />
              }
              label="Show All Payments"
            />
          </Box>

          {/* Data Grid */}
          <BaseDataTable
            title="All Payments"
            data={rows || []}
            columns={columns}
            loading={paymentsLoading}
            onRowClick={handleRowClick}
            onEdit={(row: any) => {
              setEditingPayment(row);
              setEditDialogOpen(true);
            }}
            renderForm={({ onClose, initialValues, mode }) => {
              // Look up program status from allPrograms
              const programId = (initialValues as any)?.member_program_id;
              const program = allPrograms.find((p: any) => p.member_program_id === programId);
              const programStatusName = (program?.status_name || '').toLowerCase();
              
              return (
                <MemberProgramPaymentForm
                  programId={programId}
                  initialValues={initialValues as any}
                  onSuccess={() => {
                    onClose();
                    refetch();
                  }}
                  mode={mode}
                  programStatus={programStatusName}
                />
              );
            }}
            showCreateButton={false}
            getRowId={row => row.id}
            rowClassName={(row: any) => {
              // Only highlight Pending payments
              const status = row?.payment_status_name;
              if (status !== 'Pending') return '';
              
              // Check due date for late highlighting
              const dateStr = row?.payment_due_date as string | undefined;
              if (!dateStr) return '';
              
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              // Parse as local time by appending T00:00:00
              const dueDate = new Date(dateStr + 'T00:00:00');
              
              const diffDays = Math.floor(
                (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );
              
              return diffDays < 0 ? 'row-late' : '';
            }}
            sortModel={[{ field: 'payment_due_date', sort: 'asc' }]}
          />
        </CardContent>
      </Card>

      {/* Dialog handled by BaseDataTable via renderForm */}
    </Box>
  );
}

