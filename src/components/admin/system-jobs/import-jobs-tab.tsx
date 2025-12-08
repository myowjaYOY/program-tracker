'use client';

import React, { useState } from 'react';
import { Box, Typography, CircularProgress, Alert, IconButton, Tooltip, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { useDataImportJobs, DataImportJob } from '@/lib/hooks/use-data-import-jobs';
import JobStatusChip from './job-status-chip';
import JobDetailsDialog from './job-details-dialog';

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getEntityTypeColor(entityType: string): 'primary' | 'secondary' | 'default' {
  switch (entityType.toLowerCase()) {
    case 'survey':
    case 'survey_responses':
      return 'primary';
    case 'user_progress':
      return 'secondary';
    default:
      return 'default';
  }
}

export default function ImportJobsTab() {
  const { data, isLoading, error } = useDataImportJobs();
  const [selectedJob, setSelectedJob] = useState<DataImportJob | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewDetails = (job: DataImportJob) => {
    setSelectedJob(job);
    setDialogOpen(true);
  };

  const columns: GridColDef[] = [
    {
      field: 'import_batch_id',
      headerName: 'ID',
      width: 70,
    },
    {
      field: 'file_name',
      headerName: 'File Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Tooltip title={params.value}>
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {params.value}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'entity_type',
      headerName: 'Type',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={getEntityTypeColor(params.value)}
          sx={{ textTransform: 'capitalize' }}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => <JobStatusChip status={params.value} />,
    },
    {
      field: 'started_at',
      headerName: 'Started',
      width: 170,
      renderCell: (params) => formatDateTime(params.value),
    },
    {
      field: 'file_size',
      headerName: 'Size',
      width: 90,
      renderCell: (params) => formatFileSize(params.value),
    },
    {
      field: 'total_rows',
      headerName: 'Total',
      width: 80,
      type: 'number',
      renderCell: (params) => params.value ?? '-',
    },
    {
      field: 'successful_rows',
      headerName: 'Success',
      width: 85,
      type: 'number',
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{ color: params.value > 0 ? 'success.main' : 'text.secondary' }}
        >
          {params.value ?? 0}
        </Typography>
      ),
    },
    {
      field: 'failed_rows',
      headerName: 'Failed',
      width: 80,
      type: 'number',
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{ color: params.value > 0 ? 'error.main' : 'text.secondary' }}
        >
          {params.value ?? 0}
        </Typography>
      ),
    },
    {
      field: 'bucket_name',
      headerName: 'Bucket',
      width: 140,
      renderCell: (params) => params.value || '-',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={() => handleViewDetails(params.row as DataImportJob)}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load import jobs: {error.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={data || []}
        columns={columns}
        getRowId={(row) => row.import_batch_id}
        initialState={{
          sorting: {
            sortModel: [{ field: 'started_at', sort: 'desc' }],
          },
          pagination: {
            paginationModel: { pageSize: 25 },
          },
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        sx={{
          '& .MuiDataGrid-cell': {
            display: 'flex',
            alignItems: 'center',
          },
        }}
      />

      <JobDetailsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        job={selectedJob}
        jobType="import"
      />
    </Box>
  );
}



