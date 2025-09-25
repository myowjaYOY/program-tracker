'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useAuditLogsForRecord } from '@/lib/hooks/use-audit-logs';

interface AuditHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  tableName: string;
  recordId: string;
  recordTitle?: string;
}

export default function AuditHistoryDialog({
  open,
  onClose,
  tableName,
  recordId,
  recordTitle,
}: AuditHistoryDialogProps) {
  const { data, isLoading, error } = useAuditLogsForRecord(tableName, recordId);

  const getOperationColor = (operation: string) => {
    switch (operation.toLowerCase()) {
      case 'insert':
        return 'success';
      case 'update':
        return 'warning';
      case 'delete':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="h6">Audit History</Typography>
          {recordTitle && (
            <Typography variant="body2" color="text.secondary">
              {recordTitle}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {tableName} - Record ID: {recordId}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {data && data.data.length === 0 && (
          <Alert severity="info">No audit history found for this record.</Alert>
        )}

        {data && data.data.length > 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Event At</TableCell>
                  <TableCell>Operation</TableCell>
                  <TableCell>Changed By</TableCell>
                  <TableCell>Member</TableCell>
                  <TableCell>Program</TableCell>
                  <TableCell>Summary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.data.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.event_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.operation}
                        size="small"
                        color={getOperationColor(log.operation) as any}
                      />
                    </TableCell>
                    <TableCell>
                      {log.changed_by_email || '-'}
                    </TableCell>
                    <TableCell>
                      {log.related_member_name || '-'}
                    </TableCell>
                    <TableCell>
                      {log.related_program_name || '-'}
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={log.summary || '-'}
                      >
                        {log.summary || '-'}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ borderRadius: 0 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
