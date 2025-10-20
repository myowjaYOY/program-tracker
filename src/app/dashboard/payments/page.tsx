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
  People as PeopleIcon,
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
import MemberProgramPaymentForm from '@/components/forms/member-program-payment-form';
import { MemberProgramPayments } from '@/types/database.types';

interface PaymentRow extends MemberProgramPayments {
  id: number;
  member_name?: string;
  program_name?: string;
}

export default function PaymentsPage() {
  const [memberFilter, setMemberFilter] = useState<number | null>(null);
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: metrics, isLoading: metricsLoading } = usePaymentMetrics();
  const {
    data: payments = [],
    isLoading: paymentsLoading,
    refetch,
  } = usePayments({
    memberId: memberFilter,
    hideCompleted,
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
    return uniq;
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
                    Total Amount Owed
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
                      `$${(metrics?.totalAmountOwed || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                All unpaid payments
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
                      `$${(metrics?.totalAmountDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                        `$${(metrics?.totalAmountLate || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

        {/* Card 4: Members with Payments Due */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.secondary.main}`,
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
                    Members with Payments Due
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'secondary.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.membersWithPaymentsDue || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'secondary.main',
                    opacity: 0.8,
                  }}
                >
                  <PeopleIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Distinct members with due payments
              </Typography>
            </CardContent>
          </Card>
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
                  checked={hideCompleted}
                  onChange={e => setHideCompleted(e.target.checked)}
                  size="small"
                />
              }
              label="Hide completed payments"
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
            renderForm={({ onClose, initialValues, mode }) => (
              <MemberProgramPaymentForm
                programId={(initialValues as any)?.member_program_id}
                initialValues={initialValues as any}
                onSuccess={() => {
                  onClose();
                  refetch();
                }}
                mode={mode}
                programStatus=""
              />
            )}
            showCreateButton={false}
            getRowId={row => row.id}
          />
        </CardContent>
      </Card>

      {/* Dialog handled by BaseDataTable via renderForm */}
    </Box>
  );
}

