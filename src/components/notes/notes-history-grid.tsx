'use client';

import React from 'react';
import {
  Box,
  Chip,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable from '@/components/tables/base-data-table';
import { useLeadNotes, LeadNote } from '@/lib/hooks/use-lead-notes';
import { renderDateTime } from '@/components/tables/base-data-table';

interface NotesHistoryGridProps {
  leadId: number;
  onRefresh: number; // This is a trigger value that changes when parent wants to refresh
}

const getNoteTypeColor = (noteType: string) => {
  switch (noteType) {
    case 'PME':
      return 'primary';
    case 'Win':
      return 'success';
    case 'Challenge':
      return 'error';
    case 'Other':
    default:
      return 'default';
  }
};

export default function NotesHistoryGrid({ leadId, onRefresh }: NotesHistoryGridProps) {
  const { data, isLoading, error, refetch } = useLeadNotes(leadId);

  const columns: GridColDef[] = [
    {
      field: 'created_at',
      headerName: 'Date/Time',
      width: 180,
      renderCell: renderDateTime,
      sortable: true,
    },
    {
      field: 'note_type',
      headerName: 'Type',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={getNoteTypeColor(params.value) as any}
          variant="outlined"
        />
      ),
      sortable: true,
    },
    {
      field: 'note',
      headerName: 'Content',
      flex: 1,
      minWidth: 300,
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.2,
          }}
          title={params.value}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'created_by_name',
      headerName: 'Created By',
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || 'System'}
        </Typography>
      ),
    },
  ];

  // Handle refresh from parent - onRefresh is actually a trigger value, not a function
  React.useEffect(() => {
    if (onRefresh !== undefined) {
      refetch();
    }
  }, [onRefresh, refetch]);

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Failed to load notes history
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      
      <BaseDataTable<LeadNote>
        title=""
        data={data?.data || []}
        columns={columns}
        loading={isLoading}
        getRowId={(row) => row.note_id}
        showCreateButton={false}
        showActionsColumn={false}
        autoHeight={false}
        gridHeight="400px"
        pageSize={25}
        pageSizeOptions={[10, 25, 50]}
        sx={{
          '& .MuiDataGrid-footerContainer': {
            display: 'flex',
          },
        }}
      />
    </Box>
  );
}
