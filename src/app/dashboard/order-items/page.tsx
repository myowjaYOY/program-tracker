'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  TextField,
  MenuItem,
  Chip,
  Tooltip,
  Divider,
  Checkbox,
  ListItemText,
  Select,
  InputLabel,
  FormControl,
  OutlinedInput,
  Tabs,
  Tab,
} from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import {
  PendingActions as PendingIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as ReceivedIcon,
  Cancel as CancelledIcon,
  ShoppingCart as OrderIcon,
  Inventory2 as InventoryIcon,
} from '@mui/icons-material';
import {
  useItemRequests,
  useItemRequestMetrics,
} from '@/lib/hooks/use-item-requests';
import { useAuditUsers } from '@/lib/hooks/use-audit-logs';
import { GridColDef } from '@mui/x-data-grid-pro';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import {
  getStatusColor,
  getUserDisplayName,
  isItemRequestLate,
  isItemRequestOverdue,
} from '@/lib/utils/item-request-status';
import ItemRequestForm from '@/components/forms/item-request-form';
import InventoryItemsTab from '@/components/inventory/inventory-items-tab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`order-items-tabpanel-${index}`}
      aria-labelledby={`order-items-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default function OrderItemsPage() {
  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<
    ('Pending' | 'Ordered' | 'Received' | 'Cancelled')[]
  >([]);
  const [requestedByFilter, setRequestedByFilter] = useState<string | null>(
    null
  );

  // Fetch data
  const { data: requests = [], isLoading: requestsLoading } = useItemRequests({
    status: statusFilter.length > 0 ? statusFilter : null,
    requestedBy: requestedByFilter,
  });

  const { data: metrics, isLoading: metricsLoading } = useItemRequestMetrics();

  // Fetch active users for "Requested By" filter
  const { data: users = [] } = useAuditUsers();

  // Define data grid columns (without actions column)
  const columns: GridColDef[] = [
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params: any) => (
        <Chip
          label={params.value || 'Unknown'}
          color={getStatusColor(params.value)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'requested_date',
      headerName: 'Request Date',
      width: 140,
      renderCell: renderDate,
    },
    {
      field: 'requested_by',
      headerName: 'Requested By',
      width: 180,
      renderCell: (params: any) => (
        <Typography variant="body2">
          {getUserDisplayName(
            params.row.requested_by_name,
            params.row.requested_by_email
          )}
        </Typography>
      ),
    },
    {
      field: 'member_name',
      headerName: 'Member Name',
      width: 180,
      renderCell: (params: any) => (
        <Typography variant="body2">
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'item_description',
      headerName: 'Item Description',
      width: 300,
      flex: 1,
      renderCell: (params: any) => (
        <Tooltip title={params.value || ''} arrow>
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {params.value}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: any) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'notes',
      headerName: 'Notes',
      width: 250,
      renderCell: (params: any) => (
        <Tooltip title={params.value || ''} arrow>
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {params.value || '-'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'ordered_date',
      headerName: 'Ordered Date',
      width: 140,
      renderCell: renderDate,
    },
    {
      field: 'received_date',
      headerName: 'Received Date',
      width: 140,
      renderCell: renderDate,
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
        >
          Order Items
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Card 1: Pending Requests */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.warning.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
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
                    Pending Requests
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'warning.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.pendingCount || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'warning.main',
                    opacity: 0.8,
                  }}
                >
                  <PendingIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Awaiting order placement
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: Ordered This Month */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.info.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
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
                    Ordered This Month
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'info.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.orderedThisMonth || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'info.main',
                    opacity: 0.8,
                  }}
                >
                  <ShippingIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Items ordered in current month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Received This Month */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.success.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
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
                    Received This Month
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'success.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.receivedThisMonth || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'success.main',
                    opacity: 0.8,
                  }}
                >
                  <ReceivedIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Items received in current month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 4: Cancelled */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.error.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
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
                    Cancelled
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'error.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.cancelledCount || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'error.main',
                    opacity: 0.8,
                  }}
                >
                  <CancelledIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Total cancelled requests
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mt: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              minWidth: 120,
              mx: 1.5, // Add horizontal margin for spacing between tabs
            },
          }}
        >
          <Tab
            icon={<OrderIcon />}
            iconPosition="start"
            label="Order"
            id="order-items-tab-0"
            aria-controls="order-items-tabpanel-0"
          />
          <Tab
            icon={<InventoryIcon />}
            iconPosition="start"
            label="Inventory"
            id="order-items-tab-1"
            aria-controls="order-items-tabpanel-1"
          />
        </Tabs>

        {/* Order Tab */}
        <TabPanel value={tabValue} index={0}>
          <CardContent>
            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ('Pending' | 'Ordered' | 'Received' | 'Cancelled')[])}
                  input={<OutlinedInput label="Status" />}
                  renderValue={(selected) => 
                    selected.length === 0 
                      ? 'All Statuses' 
                      : selected.join(', ')
                  }
                >
                  <MenuItem value="Pending">
                    <Checkbox checked={statusFilter.includes('Pending')} />
                    <ListItemText primary="Pending" />
                  </MenuItem>
                  <MenuItem value="Ordered">
                    <Checkbox checked={statusFilter.includes('Ordered')} />
                    <ListItemText primary="Ordered" />
                  </MenuItem>
                  <MenuItem value="Received">
                    <Checkbox checked={statusFilter.includes('Received')} />
                    <ListItemText primary="Received" />
                  </MenuItem>
                  <MenuItem value="Cancelled">
                    <Checkbox checked={statusFilter.includes('Cancelled')} />
                    <ListItemText primary="Cancelled" />
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                select
                label="Requested By"
                value={requestedByFilter ?? ''}
                onChange={(e) =>
                  setRequestedByFilter(e.target.value ? e.target.value : null)
                }
                size="small"
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">All Users</MenuItem>
                {users.map((user: any) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* Divider */}
            <Box sx={{ mb: 2 }}>
              <Divider />
            </Box>

            <BaseDataTable
              title=""
              data={requests.map((req) => ({
                ...req,
                id: req.item_request_id,
              }))}
              columns={columns}
              loading={requestsLoading}
              getRowId={(row) => row.item_request_id}
              sortModel={[{ field: 'requested_date', sort: 'asc' }]}
              rowClassName={(row) => {
                // Highlight overdue requests (>10 days old, not cancelled/received)
                if (isItemRequestOverdue(row)) {
                  return 'row-overdue';
                }
                return '';
              }}
              sx={{
                '& .row-overdue': {
                  bgcolor: (theme: Theme) => alpha(theme.palette.error.main, 0.15),
                },
              }}
              renderForm={({ onClose, initialValues, mode }) => (
                <ItemRequestForm
                  initialValues={initialValues as any}
                  onSuccess={onClose}
                  mode={mode}
                />
              )}
              showCreateButton={true}
              createButtonText="Add Request"
              showActionsColumn={false}
            />
          </CardContent>
        </TabPanel>

        {/* Inventory Tab */}
        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <InventoryItemsTab hideCostColumns={true} />
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
}

