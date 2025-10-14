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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Divider,
} from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import {
  PendingActions as PendingIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as ReceivedIcon,
  Cancel as CancelledIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
} from '@mui/icons-material';
import {
  useItemRequests,
  useItemRequestMetrics,
  useMarkOrdered,
  useMarkReceived,
} from '@/lib/hooks/use-item-requests';
import { useAuditUsers } from '@/lib/hooks/use-audit-logs';
import { GridColDef, GridActionsCellItem } from '@mui/x-data-grid-pro';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import {
  getStatusColor,
  getUserDisplayName,
  isItemRequestLate,
} from '@/lib/utils/item-request-status';
import type { ItemRequest } from '@/types/database.types';
import ItemRequestForm from '@/components/forms/item-request-form';
import CancelRequestDialog from '@/components/item-requests/cancel-request-dialog';

export default function ItemRequestsPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<
    'Pending' | 'Ordered' | 'Received' | 'Cancelled' | null
  >(null);
  const [requestedByFilter, setRequestedByFilter] = useState<string | null>(
    null
  );

  // Dialog state for forms and actions
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [confirmOrderedDialogOpen, setConfirmOrderedDialogOpen] = useState(false);
  const [confirmReceivedDialogOpen, setConfirmReceivedDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  // Fetch data
  const { data: requests = [], isLoading: requestsLoading } = useItemRequests({
    status: statusFilter,
    requestedBy: requestedByFilter,
  });

  const { data: metrics, isLoading: metricsLoading } = useItemRequestMetrics();

  // Fetch active users for "Requested By" filter
  const { data: users = [] } = useAuditUsers();

  // Mutation hooks for actions
  const markOrdered = useMarkOrdered();
  const markReceived = useMarkReceived();

  // Define data grid columns
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
      field: 'ordered',
      headerName: 'Ordered',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: any) => {
        const request = params.row;
        const isOrdered = request.ordered_date && request.ordered_by_name;
        const canOrder = request.status === 'Pending';
        
        if (isOrdered) {
          const tooltipText = `Ordered on: ${new Date(request.ordered_date).toLocaleDateString()} by ${request.ordered_by_name}`;
          return (
            <Tooltip title={tooltipText} arrow>
              <span>
                <IconButton
                  size="small"
                  color="success"
                  disabled={true}
                  sx={{ cursor: 'default' }}
                >
                  <CheckCircleOutlineIcon />
                </IconButton>
              </span>
            </Tooltip>
          );
        }
        
        return (
          <Tooltip title="Click to mark as ordered" arrow>
            <IconButton
              size="small"
              color="primary"
              disabled={!canOrder}
              onClick={() => handleOrderedCircleClick(request)}
              sx={{ cursor: canOrder ? 'pointer' : 'default' }}
            >
              <RadioButtonUncheckedIcon />
            </IconButton>
          </Tooltip>
        );
      },
    },
    {
      field: 'received',
      headerName: 'Received',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: any) => {
        const request = params.row;
        const isReceived = request.received_date && request.received_by_name;
        const canReceive = request.status === 'Ordered';
        
        if (isReceived) {
          const tooltipText = `Received on: ${new Date(request.received_date).toLocaleDateString()} by ${request.received_by_name}`;
          return (
            <Tooltip title={tooltipText} arrow>
              <span>
                <IconButton
                  size="small"
                  color="success"
                  disabled={true}
                  sx={{ cursor: 'default' }}
                >
                  <CheckCircleOutlineIcon />
                </IconButton>
              </span>
            </Tooltip>
          );
        }
        
        return (
          <Tooltip title="Click to mark as received" arrow>
            <IconButton
              size="small"
              color="primary"
              disabled={!canReceive}
              onClick={() => handleReceivedCircleClick(request)}
              sx={{ cursor: canReceive ? 'pointer' : 'default' }}
            >
              <RadioButtonUncheckedIcon />
            </IconButton>
          </Tooltip>
        );
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 120,
      getActions: (params: any) => {
        const request = params.row as ItemRequest;
        const actions: React.ReactElement<any>[] = [];

        // Edit action - only available for Pending requests (before ordered)
        if (request.status === 'Pending') {
          actions.push(
            <GridActionsCellItem
              key="edit"
              icon={
                <Tooltip title="Edit Request" placement="top">
                  <EditIcon color="primary" />
                </Tooltip>
              }
              label="Edit Request"
              onClick={() => handleEditClick(request)}
              showInMenu={false}
            />
          );
        }

        // Cancel action - only available for Pending requests (before ordered)
        if (request.status === 'Pending') {
          actions.push(
            <GridActionsCellItem
              key="cancel"
              icon={
                <Tooltip title="Cancel Request" placement="top">
                  <CancelIcon color="error" />
                </Tooltip>
              }
              label="Cancel Request"
              onClick={() => handleCancelClick(request)}
              showInMenu={false}
            />
          );
        }

        return actions;
      },
    },
  ];

  // Handler functions
  const handleCreateClick = () => {
    setCreateDialogOpen(true);
  };

  const handleEditClick = (request: any) => {
    setSelectedRequest(request);
    setEditDialogOpen(true);
  };

  const handleMarkOrdered = async (request: ItemRequest) => {
    await markOrdered.mutateAsync(request.item_request_id);
  };

  const handleMarkReceived = async (request: ItemRequest) => {
    await markReceived.mutateAsync(request.item_request_id);
  };

  const handleCancelClick = (request: any) => {
    setSelectedRequest(request);
    setCancelDialogOpen(true);
  };

  const handleOrderedCircleClick = (request: any) => {
    setSelectedRequest(request);
    setConfirmOrderedDialogOpen(true);
  };

  const handleReceivedCircleClick = (request: any) => {
    setSelectedRequest(request);
    setConfirmReceivedDialogOpen(true);
  };

  const handleConfirmOrdered = async () => {
    if (selectedRequest) {
      try {
        await markOrdered.mutateAsync(selectedRequest.item_request_id);
        handleCloseDialogs();
      } catch (error) {
        console.error('Error marking as ordered:', error);
      }
    }
  };

  const handleConfirmReceived = async () => {
    if (selectedRequest) {
      try {
        await markReceived.mutateAsync(selectedRequest.item_request_id);
        handleCloseDialogs();
      } catch (error) {
        console.error('Error marking as received:', error);
      }
    }
  };

  const handleCloseDialogs = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setCancelDialogOpen(false);
    setConfirmOrderedDialogOpen(false);
    setConfirmReceivedDialogOpen(false);
    setSelectedRequest(null);
  };

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
          Item Requests
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

      {/* Data Grid with Filters */}
      <Card>
        <CardContent>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              select
              label="Status"
              value={statusFilter ?? ''}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                    ? (e.target.value as 'Pending' | 'Ordered' | 'Received' | 'Cancelled')
                    : null
                )
              }
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Ordered">Ordered</MenuItem>
              <MenuItem value="Received">Received</MenuItem>
              <MenuItem value="Cancelled">Cancelled</MenuItem>
            </TextField>

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
            data={requests.map((req) => ({
              ...req,
              id: req.item_request_id,
            }))}
            columns={columns}
            loading={requestsLoading}
            getRowId={(row) => row.item_request_id}
            sortModel={[{ field: 'requested_date', sort: 'desc' }]}
            rowClassName={(row) => {
              // Highlight late orders (ordered > 7 days, not received)
              if (isItemRequestLate(row)) {
                return 'row-late';
              }
              return '';
            }}
            sx={{
              '& .row-late': {
                bgcolor: (theme: Theme) => alpha(theme.palette.warning.main, 0.1),
              },
            }}
            onEdit={handleEditClick}
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
      </Card>

      {/* Edit Request Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Edit Item Request
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleCloseDialogs}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <ItemRequestForm
            initialValues={selectedRequest}
            onSuccess={handleCloseDialogs}
            mode="edit"
          />
        </DialogContent>
      </Dialog>

      {/* Cancel Request Dialog */}
      {selectedRequest && (
        <CancelRequestDialog
          open={cancelDialogOpen}
          onClose={handleCloseDialogs}
          requestId={selectedRequest.item_request_id}
          itemDescription={selectedRequest.item_description}
        />
      )}

      {/* Confirm Ordered Dialog */}
      <Dialog
        open={confirmOrderedDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Confirm Order
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleCloseDialogs}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to mark this item as ordered?
          </Typography>
          {selectedRequest && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              <strong>Item:</strong> {selectedRequest.item_description}
            </Typography>
          )}
          <Typography variant="body2" color="error" sx={{ fontWeight: 'medium' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleConfirmOrdered}
            variant="contained"
            color="info"
            disabled={markOrdered.isPending}
            sx={{ borderRadius: 0 }}
          >
            {markOrdered.isPending ? 'Marking as Ordered...' : 'Confirm Order'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Received Dialog */}
      <Dialog
        open={confirmReceivedDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Confirm Receipt
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleCloseDialogs}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to mark this item as received?
          </Typography>
          {selectedRequest && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              <strong>Item:</strong> {selectedRequest.item_description}
            </Typography>
          )}
          <Typography variant="body2" color="error" sx={{ fontWeight: 'medium' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleConfirmReceived}
            variant="contained"
            color="success"
            disabled={markReceived.isPending}
            sx={{ borderRadius: 0 }}
          >
            {markReceived.isPending ? 'Marking as Received...' : 'Confirm Receipt'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

