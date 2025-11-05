'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  IconButton,
  TextField,
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

  const { data: sessions, isLoading, error } = useCountSessions();
  const cancelMutation = useCancelCountSession();

  const handleViewSession = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setDetailModalOpen(true);
  };

  const handleCancelSession = async (sessionId: number) => {
    if (confirm('Are you sure you want to cancel this count session?')) {
      await cancelMutation.mutateAsync(sessionId);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'session_number',
      headerName: 'Session #',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {params.value}
        </Typography>
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
        <Chip
          label={params.value}
          size="small"
          sx={{
            textTransform: 'capitalize',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        />
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
      ),
    },
    {
      field: 'items_with_variance',
      headerName: 'Variances',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) =>
        params.value > 0 ? (
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.main' }}>
            {params.value}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            0
          </Typography>
        ),
    },
    {
      field: 'items_pending_approval',
      headerName: 'Pending Approval',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) =>
        params.value > 0 ? (
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
        <Box>
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
      {/* Header Section */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Physical Count Sessions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage physical inventory counts and variance approvals
          </Typography>
        </Box>
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

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1, borderTop: (theme) => `4px solid ${theme.palette.primary.main}` }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              In-Progress Sessions
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {sessions?.filter((s) => s.status === 'in_progress').length || 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, borderTop: (theme) => `4px solid ${theme.palette.success.main}` }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Completed Today
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
              {sessions?.filter(
                (s) =>
                  s.status === 'completed' &&
                  new Date(s.session_date).toDateString() === new Date().toDateString()
              ).length || 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, borderTop: (theme) => `4px solid ${theme.palette.warning.main}` }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Pending Approvals
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {sessions?.reduce((sum, s) => sum + (s.items_pending_approval || 0), 0) || 0}
            </Typography>
          </CardContent>
        </Card>
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
    </Box>
  );
}

