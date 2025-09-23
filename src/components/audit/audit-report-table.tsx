'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable from '@/components/tables/base-data-table';
import {
  useAuditLogs,
  useAuditTables,
  useAuditOperations,
  useAuditUsers,
  AuditLogsFilters,
  AuditLog,
} from '@/lib/hooks/use-audit-logs';
import {
  renderDate,
  renderDateTime,
} from '@/components/tables/base-data-table';

export default function AuditReportTable() {
  const [filters, setFilters] = useState<AuditLogsFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: auditData, isLoading, error, refetch } = useAuditLogs(filters);
  const { data: availableTables } = useAuditTables();
  const { data: availableOperations } = useAuditOperations();
  const { data: availableUsers } = useAuditUsers();

  const handleFilterChange = (key: keyof AuditLogsFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailDialogOpen(false);
    setSelectedLog(null);
  };

  const clearFilters = () => {
    setFilters({});
  };

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

  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      width: 80,
      type: 'number',
    },
    {
      field: 'table_name',
      headerName: 'Table',
      width: 150,
      renderCell: params => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          color="primary"
        />
      ),
    },
    {
      field: 'record_id',
      headerName: 'Record ID',
      width: 100,
      type: 'number',
    },
    {
      field: 'operation',
      headerName: 'Operation',
      width: 100,
      renderCell: params => (
        <Chip
          label={params.value}
          size="small"
          color={getOperationColor(params.value) as any}
        />
      ),
    },
    {
      field: 'column_name',
      headerName: 'Column',
      width: 150,
      renderCell: params => params.value || '-',
    },
    {
      field: 'changed_by_name',
      headerName: 'Changed By',
      width: 150,
      renderCell: params => params.value || params.row.changed_by_email || '-',
    },
    {
      field: 'changed_at',
      headerName: 'Changed At',
      width: 180,
      renderCell: renderDateTime,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      renderCell: params => (
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={() => handleViewDetails(params.row)}
          >
            <ViewIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const mappedAuditLogs =
    auditData?.data?.map(log => ({
      ...log,
      id: log.id,
    })) || [];

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h5" fontWeight={600} color="text.primary">
          Audit Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Table</InputLabel>
                <Select
                  value={filters.table_name || ''}
                  label="Table"
                  onChange={e =>
                    handleFilterChange(
                      'table_name',
                      e.target.value || undefined
                    )
                  }
                >
                  <MenuItem value="">All Tables</MenuItem>
                  {availableTables?.map(table => (
                    <MenuItem key={table} value={table}>
                      {table}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Operation</InputLabel>
                <Select
                  value={filters.operation || ''}
                  label="Operation"
                  onChange={e =>
                    handleFilterChange('operation', e.target.value || undefined)
                  }
                >
                  <MenuItem value="">All Operations</MenuItem>
                  {availableOperations?.map(operation => (
                    <MenuItem key={operation} value={operation}>
                      {operation}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Record ID"
                value={filters.record_id || ''}
                onChange={e =>
                  handleFilterChange('record_id', e.target.value || undefined)
                }
                type="number"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Changed By</InputLabel>
                <Select
                  value={filters.changed_by || ''}
                  label="Changed By"
                  onChange={e =>
                    handleFilterChange(
                      'changed_by',
                      e.target.value || undefined
                    )
                  }
                >
                  <MenuItem value="">All Users</MenuItem>
                  {availableUsers?.map(user => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Start Date"
                type="date"
                value={filters.start_date || ''}
                onChange={e =>
                  handleFilterChange('start_date', e.target.value || undefined)
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="End Date"
                type="date"
                value={filters.end_date || ''}
                onChange={e =>
                  handleFilterChange('end_date', e.target.value || undefined)
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" size="small" onClick={clearFilters}>
                  Clear
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      )}

      {/* Performance Info */}
      {auditData?.data && auditData.data.length > 100 && (
        <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            💡 <strong>Performance Tip:</strong> With {auditData.data.length}{' '}
            records loaded, use filters to narrow down results for faster
            loading. Consider using date ranges or specific tables to improve
            performance.
          </Typography>
        </Box>
      )}

      {/* Data Grid */}
      <BaseDataTable
        title=""
        data={mappedAuditLogs}
        columns={columns}
        loading={isLoading}
        showCreateButton={false}
        showEditButton={false}
        showDeleteButton={false}
        showTitle={false}
        showActionsColumn={false}
        autoHeight={false}
        gridHeight="calc(100vh - 200px)"
        pageSize={50}
        pageSizeOptions={[25, 50, 100, 200]}
        disableRowSelectionOnClick
        disableColumnMenu={false}
        disableColumnFilter={false}
        disableColumnSelector={false}
      />

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          Audit Log Details
          <IconButton onClick={handleCloseDetails} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Table
                  </Typography>
                  <Typography variant="body1">
                    {selectedLog.table_name}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Record ID
                  </Typography>
                  <Typography variant="body1">
                    {selectedLog.record_id}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Operation
                  </Typography>
                  <Chip
                    label={selectedLog.operation}
                    color={getOperationColor(selectedLog.operation) as any}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Changed By
                  </Typography>
                  <Typography variant="body1">
                    {selectedLog.changed_by_name ||
                      selectedLog.changed_by_email ||
                      '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Changed At
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedLog.changed_at).toLocaleString()}
                  </Typography>
                </Grid>
                {selectedLog.column_name && (
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Column
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.column_name}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              {/* Old Value */}
              {selectedLog.old_value && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Old Value
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                      {JSON.stringify(selectedLog.old_value, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}

              {/* New Value */}
              {selectedLog.new_value && (
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    New Value
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                      {JSON.stringify(selectedLog.new_value, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails} sx={{ borderRadius: 0 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
