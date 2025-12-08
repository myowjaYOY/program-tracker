'use client';

import React, { useState } from 'react';
import { Box, Typography, CircularProgress, Alert, IconButton, Tooltip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { useCronJobRuns, CronJobRun } from '@/lib/hooks/use-cron-job-runs';
import JobStatusChip from './job-status-chip';
import JobDetailsDialog from './job-details-dialog';

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined) return '-';
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${Math.floor(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`;
}

export default function ScheduledJobsTab() {
  const { data, isLoading, error } = useCronJobRuns();
  const [selectedJob, setSelectedJob] = useState<CronJobRun | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewDetails = (job: CronJobRun) => {
    setSelectedJob(job);
    setDialogOpen(true);
  };

  const columns: GridColDef[] = [
    {
      field: 'run_id',
      headerName: 'ID',
      width: 70,
    },
    {
      field: 'job_name',
      headerName: 'Job Name',
      flex: 1,
      minWidth: 200,
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
      field: 'duration_ms',
      headerName: 'Duration',
      width: 100,
      renderCell: (params) => formatDuration(params.value),
    },
    {
      field: 'memberships_found',
      headerName: 'Found',
      width: 80,
      type: 'number',
    },
    {
      field: 'memberships_processed',
      headerName: 'Processed',
      width: 100,
      type: 'number',
    },
    {
      field: 'memberships_failed',
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
      field: 'triggered_by',
      headerName: 'Triggered By',
      width: 110,
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
            onClick={() => handleViewDetails(params.row as CronJobRun)}
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
        Failed to load scheduled jobs: {error.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={data || []}
        columns={columns}
        getRowId={(row) => row.run_id}
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
        jobType="cron"
      />
    </Box>
  );
}


