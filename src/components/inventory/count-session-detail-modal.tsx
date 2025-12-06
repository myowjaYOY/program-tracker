'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGridPro, GridColDef, GridRenderCellParams } from '@mui/x-data-grid-pro';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Publish as PublishIcon,
} from '@mui/icons-material';
import {
  useCountSession,
  useBatchUpdateCountDetails,
  useApproveVariances,
  usePostCountSession,
  CountDetail,
} from '@/lib/hooks/use-inventory-counts';
import { format } from 'date-fns';

interface CountSessionDetailModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: number;
}

export default function CountSessionDetailModal({
  open,
  onClose,
  sessionId,
}: CountSessionDetailModalProps) {
  const { data: session, isLoading } = useCountSession(sessionId);
  const batchUpdateMutation = useBatchUpdateCountDetails();
  const approveMutation = useApproveVariances();
  const postMutation = usePostCountSession();

  const [counts, setCounts] = useState<Record<number, { quantity: number; notes?: string }>>({});
  const [approvals, setApprovals] = useState<Record<number, boolean>>({});
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);

  // Determine if user is admin (for simplicity, checking if any variance requires approval)
  const isAdmin = true; // In production, fetch from user context

  const canPost = useMemo(() => {
    if (!session || session.status !== 'in_progress') return false;
    
    const allCounted = session.details.every((d: CountDetail) => d.physical_quantity !== null);
    const allApproved = session.details.every(
      (d: CountDetail) => !d.requires_approval || d.status === 'approved'
    );
    
    return allCounted && allApproved;
  }, [session]);

  const handleSaveCounts = async () => {
    const updates = Object.entries(counts).map(([detailId, data]) => {
      const update: any = {
        count_detail_id: parseInt(detailId),
        physical_quantity: data.quantity,
      };
      if (data.notes) {
        update.notes = data.notes;
      }
      return update;
    });

    if (updates.length > 0) {
      await batchUpdateMutation.mutateAsync({
        count_session_id: sessionId,
        updates,
      });
      setCounts({});
    }
  };

  const handleApproveAll = async () => {
    const pendingVariances = session?.details.filter(
      (d: CountDetail) => d.requires_approval && d.status === 'counted'
    );

    if (pendingVariances && pendingVariances.length > 0) {
      await approveMutation.mutateAsync({
        count_session_id: sessionId,
        approvals: pendingVariances.map((d: CountDetail) => ({
          count_detail_id: d.count_detail_id,
          approved: true,
        })),
      });
    }
  };

  const handlePostSession = () => {
    setPostConfirmOpen(true);
  };

  const handleConfirmPost = async () => {
    await postMutation.mutateAsync(sessionId);
    setPostConfirmOpen(false);
    onClose();
  };

  const handleCancelPost = () => {
    setPostConfirmOpen(false);
  };

  const columns: GridColDef[] = [
    {
      field: 'therapy_name',
      headerName: 'Item Name',
      flex: 2,
      valueGetter: (_, row) => row.inventory_item?.therapy?.therapy_name || 'N/A',
    },
    {
      field: 'expected_quantity',
      headerName: 'Expected',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'physical_quantity',
      headerName: 'Physical',
      renderCell: (params: GridRenderCellParams) => {
        const detail = params.row as CountDetail;
        const currentValue = counts[detail.count_detail_id];

        if (session?.status !== 'in_progress') {
          return detail.physical_quantity ?? '-';
        }

        return (
          <TextField
            type="number"
            size="small"
            value={
              currentValue?.quantity !== undefined
                ? currentValue.quantity
                : detail.physical_quantity ?? ''
            }
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value)) {
                setCounts((prev) => ({
                  ...prev,
                  [detail.count_detail_id]: { quantity: value },
                }));
              }
            }}
            sx={{ width: '100px' }}
            inputProps={{ min: 0 }}
          />
        );
      },
    },
    {
      field: 'variance',
      headerName: 'Variance',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        if (params.value === null || params.value === 0) return '-';
        return (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: params.value > 0 ? 'success.main' : 'error.main',
            }}
          >
            {params.value > 0 ? '+' : ''}
            {params.value}
          </Typography>
        );
      },
    },
    {
      field: 'variance_pct',
      headerName: 'Variance %',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        if (params.value === null || params.value === 0) return '-';
        return (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: Math.abs(params.value) > 10 ? 'warning.main' : 'text.secondary',
            }}
          >
            {params.value.toFixed(1)}%
          </Typography>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      renderCell: (params: GridRenderCellParams) => {
        const statusColors: Record<string, any> = {
          pending: 'default',
          counted: 'info',
          approved: 'success',
          rejected: 'error',
          posted: 'success',
        };
        return (
          <Chip
            label={params.value}
            size="small"
            color={statusColors[params.value]}
            sx={{ textTransform: 'capitalize', fontSize: '0.75rem', fontWeight: 600 }}
          />
        );
      },
    },
    {
      field: 'requires_approval',
      headerName: 'Approval',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        if (!params.value) return '-';
        const detail = params.row as CountDetail;
        
        if (detail.status === 'approved') {
          return <CheckCircleIcon color="success" fontSize="small" />;
        }
        
        if (detail.status === 'rejected') {
          return <CancelIcon color="error" fontSize="small" />;
        }

        return (
          <Chip
            label="Required"
            size="small"
            color="warning"
            sx={{ fontSize: '0.7rem', fontWeight: 600 }}
          />
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (!session) {
    return null;
  }

  const pendingCount = session.details.filter((d: CountDetail) => d.physical_quantity === null).length;
  const varianceCount = session.details.filter((d: CountDetail) => d.variance !== 0).length;
  const pendingApprovalCount = session.details.filter(
    (d: CountDetail) => d.requires_approval && d.status === 'counted'
  ).length;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Count Session: {session.session_number}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {format(new Date(session.session_date), 'MMMM dd, yyyy')}
              </Typography>
              <Typography variant="body2" color="text.secondary">•</Typography>
              <Chip
                label={session.status}
                size="small"
                color={
                  session.status === 'completed'
                    ? 'success'
                    : session.status === 'in_progress'
                    ? 'primary'
                    : 'default'
                }
                sx={{ textTransform: 'capitalize', fontSize: '0.75rem' }}
              />
            </Box>
          </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {Object.keys(counts).length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveCounts}
                  disabled={batchUpdateMutation.isPending}
                >
                  Save Counts
                </Button>
              )}
              {isAdmin && pendingApprovalCount > 0 && (
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleApproveAll}
                  disabled={approveMutation.isPending}
                >
                  Approve All ({pendingApprovalCount})
                </Button>
              )}
              {canPost && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PublishIcon />}
                  onClick={handlePostSession}
                  disabled={postMutation.isPending}
                >
                  Post to Inventory
                </Button>
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
            <Alert severity={pendingCount > 0 ? 'warning' : 'success'} sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {pendingCount > 0
                  ? `${pendingCount} item(s) not counted yet`
                  : 'All items have been counted'}
              </Typography>
            </Alert>
            {varianceCount > 0 && (
              <Alert severity="warning" sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {varianceCount} item(s) with variance
                </Typography>
              </Alert>
            )}
            {pendingApprovalCount > 0 && (
              <Alert severity="error" sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {pendingApprovalCount} variance(s) require admin approval
                </Typography>
              </Alert>
            )}
          </Box>

          <DataGridPro
            rows={session.details}
            columns={columns}
            getRowId={(row) => row.count_detail_id}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25, page: 0 },
              },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableRowSelectionOnClick
            autoHeight
            showToolbar
            sx={{
              border: 0,
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
            }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Post Confirmation Dialog */}
      <Dialog
        open={postConfirmOpen}
        onClose={handleCancelPost}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Post Count to Inventory</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to post this count session to inventory? This will update the quantities on hand for all items in this count. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCancelPost}
            color="primary"
            sx={{ borderRadius: 0 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPost}
            color="success"
            variant="contained"
            sx={{ borderRadius: 0 }}
            disabled={postMutation.isPending}
          >
            {postMutation.isPending ? 'Posting...' : 'Post to Inventory'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

