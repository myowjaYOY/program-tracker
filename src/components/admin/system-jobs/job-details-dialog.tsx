'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Grid,
  Paper,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Collapse,
} from '@mui/material';
import { 
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import JobStatusChip from './job-status-chip';
import { CronJobRun } from '@/lib/hooks/use-cron-job-runs';
import { DataImportJob, DataImportError, useDataImportErrors } from '@/lib/hooks/use-data-import-jobs';

interface JobDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  job: CronJobRun | DataImportJob | null;
  jobType: 'cron' | 'import';
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function formatDuration(durationMs: number | null | undefined, durationStr?: string | null): string {
  if (durationStr) return durationStr;
  if (durationMs === null || durationMs === undefined) return '-';
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${Math.floor(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Grid container spacing={2} sx={{ py: 0.5 }}>
      <Grid size={{ xs: 5 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {label}
        </Typography>
      </Grid>
      <Grid size={{ xs: 7 }}>
        <Typography variant="body2">{value ?? '-'}</Typography>
      </Grid>
    </Grid>
  );
}

function CronJobDetails({ job }: { job: CronJobRun }) {
  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Job Information
        </Typography>
        <DetailRow label="Job Name" value={job.job_name} />
        <DetailRow label="Status" value={<JobStatusChip status={job.status} />} />
        <DetailRow label="Triggered By" value={job.triggered_by} />
        <DetailRow label="Started At" value={formatDateTime(job.started_at)} />
        <DetailRow label="Completed At" value={formatDateTime(job.completed_at)} />
        <DetailRow label="Duration" value={formatDuration(job.duration_ms)} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Processing Results
        </Typography>
        <DetailRow label="Memberships Found" value={job.memberships_found} />
        <DetailRow label="Memberships Processed" value={job.memberships_processed} />
        <DetailRow label="Memberships Skipped" value={job.memberships_skipped} />
        <DetailRow label="Memberships Failed" value={job.memberships_failed} />
        <Divider sx={{ my: 1 }} />
        <DetailRow label="Payments Created" value={job.total_payments_created} />
        <DetailRow label="Items Created" value={job.total_items_created} />
      </Paper>

      {job.errors && job.errors.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="error">
            Errors
          </Typography>
          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            {job.errors.map((error, index) => (
              <Alert key={index} severity="error" sx={{ mb: 1 }}>
                <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                  {JSON.stringify(error, null, 2)}
                </Typography>
              </Alert>
            ))}
          </Box>
        </Paper>
      )}
    </>
  );
}

function ImportErrorsSection({ importBatchId, failedRows }: { importBatchId: number; failedRows: number | null }) {
  const [expanded, setExpanded] = React.useState(true);
  const { data: errors, isLoading, error } = useDataImportErrors(importBatchId);

  if (!failedRows || failedRows === 0) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer',
          mb: expanded ? 2 : 0,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon color="error" fontSize="small" />
          <Typography variant="subtitle2" color="error">
            Failed Rows ({failedRows})
          </Typography>
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            Failed to load error details: {error.message}
          </Alert>
        )}

        {errors && errors.length > 0 && (
          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 60 }}>Row</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 120 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Error Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {errors.map((err) => (
                  <TableRow key={err.import_error_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {err.row_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={err.severity === 'error' ? <ErrorIcon /> : <WarningIcon />}
                        label={err.error_type.replace(/_/g, ' ')}
                        size="small"
                        color={err.severity === 'error' ? 'error' : 'warning'}
                        variant="outlined"
                        sx={{ 
                          fontSize: '0.7rem',
                          height: 24,
                          '& .MuiChip-icon': { fontSize: '0.875rem' },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          wordBreak: 'break-word',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {err.error_message}
                      </Typography>
                      {err.field_name && (
                        <Typography variant="caption" color="text.secondary">
                          Field: {err.field_name}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {errors && errors.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No detailed error information available
          </Typography>
        )}
      </Collapse>
    </Paper>
  );
}

function ImportJobDetails({ job }: { job: DataImportJob }) {
  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Import Information
        </Typography>
        <DetailRow label="File Name" value={job.file_name} />
        <DetailRow label="Entity Type" value={job.entity_type} />
        <DetailRow label="Bucket" value={job.bucket_name} />
        <DetailRow label="File Size" value={job.file_size ? `${(job.file_size / 1024).toFixed(1)} KB` : '-'} />
        <DetailRow label="Status" value={<JobStatusChip status={job.status} />} />
        <DetailRow label="Started At" value={formatDateTime(job.started_at)} />
        <DetailRow label="Completed At" value={formatDateTime(job.completed_at)} />
        <DetailRow label="Duration" value={formatDuration(null, job.processing_duration)} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Row Processing
        </Typography>
        <DetailRow label="Total Rows" value={job.total_rows} />
        <DetailRow 
          label="Successful" 
          value={
            <Typography variant="body2" color="success.main" fontWeight={500}>
              {job.successful_rows ?? 0}
            </Typography>
          } 
        />
        <DetailRow 
          label="Failed" 
          value={
            <Typography 
              variant="body2" 
              color={job.failed_rows && job.failed_rows > 0 ? 'error.main' : 'text.primary'}
              fontWeight={job.failed_rows && job.failed_rows > 0 ? 500 : 400}
            >
              {job.failed_rows ?? 0}
            </Typography>
          } 
        />
        <DetailRow label="Skipped" value={job.skipped_rows} />
      </Paper>

      {/* Failed Rows Detail Section */}
      <ImportErrorsSection 
        importBatchId={job.import_batch_id} 
        failedRows={job.failed_rows} 
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Created Records
        </Typography>
        <DetailRow label="Users Mapped" value={job.new_users_mapped} />
        <DetailRow label="Programs Created" value={job.new_programs_created} />
        <DetailRow label="Modules Created" value={job.new_modules_created} />
        <DetailRow label="Forms Created" value={job.new_forms_created} />
        <DetailRow label="Questions Created" value={job.new_questions_created} />
        <DetailRow label="Sessions Created" value={job.new_sessions_created} />
        <DetailRow label="Responses Created" value={job.new_responses_created} />
      </Paper>

      {job.error_summary && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="error">
            Error Summary
          </Typography>
          <Alert severity="error">
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {job.error_summary}
            </Typography>
          </Alert>
        </Paper>
      )}

      {job.warnings && job.warnings.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="warning.main">
            Warnings
          </Typography>
          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            {job.warnings.map((warning, index) => (
              <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                  {JSON.stringify(warning, null, 2)}
                </Typography>
              </Alert>
            ))}
          </Box>
        </Paper>
      )}
    </>
  );
}

export default function JobDetailsDialog({
  open,
  onClose,
  job,
  jobType,
}: JobDetailsDialogProps) {
  if (!job) return null;

  const title = jobType === 'cron' 
    ? `Cron Job Run #${(job as CronJobRun).run_id}`
    : `Import Job #${(job as DataImportJob).import_batch_id}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">{title}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {jobType === 'cron' ? (
          <CronJobDetails job={job as CronJobRun} />
        ) : (
          <ImportJobDetails job={job as DataImportJob} />
        )}
      </DialogContent>
    </Dialog>
  );
}
