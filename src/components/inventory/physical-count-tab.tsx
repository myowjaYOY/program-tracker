'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useCountSessions, useCancelCountSession } from '@/lib/hooks/use-inventory-counts';
import StartCountModal from './start-count-modal';
import CountSessionDetailModal from './count-session-detail-modal';
import { format } from 'date-fns';

export default function PhysicalCountTab() {
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [sessionToCancel, setSessionToCancel] = useState<number | null>(null);

  const { data: sessions, isLoading, error } = useCountSessions();
  const cancelMutation = useCancelCountSession();

  const handleViewSession = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setDetailModalOpen(true);
  };

  const handleCancelSession = (sessionId: number) => {
    setSessionToCancel(sessionId);
    setCancelConfirmOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (sessionToCancel) {
      await cancelMutation.mutateAsync(sessionToCancel);
      setCancelConfirmOpen(false);
      setSessionToCancel(null);
    }
  };

  const handleCancelClose = () => {
    setCancelConfirmOpen(false);
    setSessionToCancel(null);
  };

  const columns: GridColDef[] = [
    {
      field: 'session_number',
      headerName: 'Session #',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'session_date',
      headerName: 'Date',
      valueGetter: (_, row) =>
        row.session_date ? format(new Date(row.session_date), 'MMM dd, yyyy') : 'N/A',
    },
    {
      field: 'count_type',
      headerName: 'Type',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip
            label={params.value}
            size="small"
            sx={{
              textTransform: 'capitalize',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          />
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      renderCell: (params: GridRenderCellParams) => {
        const statusColors: Record<string, string> = {
          in_progress: 'primary',
          completed: 'success',
          cancelled: 'default',
        };
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip
              label={params.value.replace('_', ' ')}
              size="small"
              color={statusColors[params.value] as any}
              sx={{
                textTransform: 'capitalize',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            />
          </Box>
        );
      },
    },
    {
      field: 'items_total',
      headerName: 'Total Items',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'items_counted',
      headerName: 'Counted',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color:
                params.row.items_counted === params.row.items_total
                  ? 'success.main'
                  : 'text.secondary',
            }}
          >
            {params.value} / {params.row.items_total}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'items_with_variance',
      headerName: 'Variances',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
          {params.value > 0 ? (
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.main' }}>
              {params.value}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              0
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'items_pending_approval',
      headerName: 'Pending Approval',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
          {params.value > 0 ? (
            <Chip
              label={params.value}
              size="small"
              color="secondary"
              sx={{ fontWeight: 600 }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              0
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'counted_by_user',
      headerName: 'Counted By',
      flex: 1,
      valueGetter: (_, row) => row.counted_by_user?.full_name || 'N/A',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleViewSession(params.row.count_session_id)}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          {params.row.status === 'in_progress' && (
            <IconButton
              size="small"
              color="error"
              onClick={() => handleCancelSession(params.row.count_session_id)}
              title="Cancel Session"
            >
              <CancelIcon fontSize="small" />
            </IconButton>
          )}
          {params.row.status === 'completed' && (
            <IconButton size="small" color="success" title="Completed" disabled>
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ),
    },
  ];

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          Failed to load count sessions. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Start New Count button */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          mb: 3,
        }}
      >
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setStartModalOpen(true)}
          sx={{
            borderRadius: 0,
            fontWeight: 600,
          }}
        >
          Start New Count
        </Button>
      </Box>

      {/* Count Sessions Table */}
      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <DataGrid
          rows={sessions || []}
          columns={columns}
          getRowId={(row) => row.count_session_id}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25, page: 0 },
            },
            sorting: {
              sortModel: [{ field: 'session_date', sort: 'desc' }],
            },
          }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            border: 0,
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'grey.50',
              borderBottom: 2,
              borderColor: 'divider',
              fontWeight: 600,
            },
          }}
        />
      )}

      {/* Modals */}
      <StartCountModal
        open={startModalOpen}
        onClose={() => setStartModalOpen(false)}
      />

      {selectedSessionId && (
        <CountSessionDetailModal
          open={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedSessionId(null);
          }}
          sessionId={selectedSessionId}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelConfirmOpen}
        onClose={handleCancelClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Cancel Count Session</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel this count session? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCancelClose}
            color="primary"
            sx={{ borderRadius: 0 }}
          >
            No, Keep Session
          </Button>
          <Button
            onClick={handleConfirmCancel}
            color="error"
            variant="contained"
            sx={{ borderRadius: 0 }}
          >
            Yes, Cancel Session
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

