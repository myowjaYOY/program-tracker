'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
  Chip,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  DataGridPro,
  GridColDef,
  GridActionsCellItem,
  GridRowId,
  GridRenderCellParams,
} from '@mui/x-data-grid-pro';
import { alpha } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// Common column renderers
export const renderActiveFlag = (params: GridRenderCellParams) => (
  <Chip
    label={params && params.value ? 'Active' : 'Inactive'}
    color={params && params.value ? 'success' : 'default'}
    size="small"
    variant="outlined"
  />
);

export const renderCurrency = (params: GridRenderCellParams) => (
  <Typography variant="body2">
    {params.value
      ? `$${Number(params.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '-'}
  </Typography>
);

export const renderDate = (params: GridRenderCellParams) => {
  if (!params || !params.value) return <Typography variant="body2">-</Typography>;
  const v = params.value as string;
  // If value is a date-only string (YYYY-MM-DD), avoid UTC parsing shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    const local = new Date(y, (m || 1) - 1, d || 1);
    return <Typography variant="body2">{local.toLocaleDateString('en-US')}</Typography>;
  }
  return (
    <Typography variant="body2">{new Date(v).toLocaleDateString('en-US')}</Typography>
  );
};

export const renderDateTime = (params: GridRenderCellParams) => (
  <Typography variant="body2">
    {params.value ? new Date(params.value).toLocaleString('en-US') : '-'}
  </Typography>
);

export const renderCreatedBy = (params: GridRenderCellParams) => (
  <Typography variant="body2">{params && params.value || '-'}</Typography>
);

export const renderUpdatedBy = (params: GridRenderCellParams) => (
  <Typography variant="body2">{params && params.value || '-'}</Typography>
);

export const renderPhone = (params: GridRenderCellParams) => {
  if (!params.value) return <Typography variant="body2">-</Typography>;

  // Format phone number: (XXX) XXX-XXXX
  const phone = params.value.toString().replace(/\D/g, '');
  if (phone.length === 10) {
    const formatted = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    return <Typography variant="body2">{formatted}</Typography>;
  }
  return <Typography variant="body2">{params.value}</Typography>;
};

// These columns expect *_by_email fields (e.g., created_by_email, updated_by_email) for display.

// Base entity interface
export interface BaseEntity {
  id: string | number;
  active_flag?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Props interface
export interface BaseDataTableProps<T extends BaseEntity> {
  title: string;
  data: T[];
  columns: GridColDef[];
  loading?: boolean;
  error?: string | null;
  getRowId?: (row: T) => GridRowId;
  onEdit?: (row: T) => void;
  onDelete?: (id: GridRowId) => void;
  renderForm?: (props: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<T>;
    mode: 'create' | 'edit';
  }) => React.ReactNode;
  createButtonText?: string;
  editButtonText?: string;
  deleteButtonText?: string;
  deleteConfirmMessage?: string;
  showCreateButton?: boolean;
  showActionsColumn?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  sx?: any;
  additionalHeaderButtons?: React.ReactNode;
  onRowClick?: (row: T) => void;
  autoHeight?: boolean;
  selectedRowId?: GridRowId | null;
  // Optional: add custom row class names (combined with selection class)
  rowClassName?: (row: T) => string;
  // Expandable rows functionality
  renderDetailPanel?: (row: T) => React.ReactNode;
  getDetailPanelHeight?: (row: T) => number;
  // Custom height override
  gridHeight?: string | number;
}

export default function BaseDataTable<T extends BaseEntity>({
  title,
  data,
  columns,
  loading = false,
  error = null,
  getRowId,
  onEdit,
  onDelete,
  onRowClick,
  renderForm,
  createButtonText = 'Create',
  editButtonText = 'Edit',
  deleteButtonText = 'Delete',
  deleteConfirmMessage = 'Are you sure you want to delete this item?',
  showCreateButton = true,
  showActionsColumn = true,
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  sx,
  additionalHeaderButtons,
  autoHeight = false,
  selectedRowId = null,
  rowClassName,
  renderDetailPanel,
  getDetailPanelHeight,
  gridHeight,
}: BaseDataTableProps<T>) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<T | undefined>(undefined);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [expandedRow, setExpandedRow] = useState<GridRowId | null>(null);

  // Actions column
  const actionsColumn: GridColDef = useMemo(
    () => ({
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 120,
      getActions: params => [
        ...(onEdit
          ? [
              <GridActionsCellItem
                key="edit"
                icon={
                  <Tooltip title={editButtonText}>
                    <EditIcon />
                  </Tooltip>
                }
                label={editButtonText}
                onClick={() => handleEdit(params.row)}
                color="primary"
              />,
            ]
          : []),
        ...(onDelete
          ? [
              <GridActionsCellItem
                key="delete"
                icon={
                  <Tooltip title={deleteButtonText}>
                    <DeleteIcon />
                  </Tooltip>
                }
                label={deleteButtonText}
                onClick={() => handleDelete(params.id)}
              />,
            ]
          : []),
      ],
    }),
    [onEdit, onDelete, editButtonText, deleteButtonText]
  );

  // All columns including actions
  const allColumns = useMemo(() => {
    if (showActionsColumn) {
      return [...columns, actionsColumn];
    }
    return columns;
  }, [columns, actionsColumn, showActionsColumn]);

  // Handle edit
  const handleEdit = (row: T) => {
    setEditingRow(row);
    setFormMode('edit');
    setFormOpen(true);
  };

  // Handle delete
  const handleDelete = (id: GridRowId) => {
    if (window.confirm(deleteConfirmMessage)) {
      onDelete?.(id);
    }
  };

  // Handle create
  const handleCreate = () => {
    setEditingRow(undefined);
    setFormMode('create');
    setFormOpen(true);
  };

  // Handle form close
  const handleFormClose = () => {
    setFormOpen(false);
    setEditingRow(undefined);
  };

  // Handle form success
  const handleFormSuccess = () => {
    handleFormClose();
  };

  // Prepare detail panel props conditionally
  const detailPanelProps = renderDetailPanel
    ? {
        detailPanelExpandedRowIds: expandedRow
          ? new Set<GridRowId>([expandedRow])
          : new Set<GridRowId>(),
        onDetailPanelExpandedRowIdsChange: (
          newExpandedRowIds: Set<GridRowId>
        ) => {
          const expandedArray = Array.from(newExpandedRowIds);
          // Auto-collapse: only keep the last expanded row (or none if all collapsed)
          const lastExpandedRow =
            expandedArray.length > 0
              ? expandedArray[expandedArray.length - 1]
              : null;
          setExpandedRow(lastExpandedRow || null);
        },
        getDetailPanelHeight: getDetailPanelHeight
          ? (params: any) => getDetailPanelHeight(params.row as T)
          : () => 250,
        getDetailPanelContent: ({ row }: { row: any }) =>
          renderDetailPanel(row as T),
      }
    : {};

  return (
    <Box sx={{ width: '100%', height: '100%', ...sx }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 2, sm: 0 },
          mb: 2,
        }}
      >
        <Typography variant="h5" fontWeight={600} color="text.primary">
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {additionalHeaderButtons}
          {showCreateButton && renderForm && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleCreate}
              sx={{
                borderRadius: 0,
                fontWeight: 600,
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              {createButtonText}
            </Button>
          )}
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Data Grid */}
      <Box
        sx={{
          height: autoHeight ? 'auto' : (gridHeight || { xs: 400, sm: 500, md: 600 }),
          width: '100%',
          position: autoHeight ? 'static' : 'relative',
        }}
      >
        <DataGridPro
          rows={data}
          columns={allColumns}
          loading={loading}
          rowHeight={40}
          autoHeight={autoHeight}
          getRowId={getRowId || (row => row.id)}
          pagination={true}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize },
            },
          }}
          pageSizeOptions={pageSizeOptions}
          {...(onRowClick && { onRowClick: (params: any) => onRowClick(params.row) })}
          getRowClassName={(params) => {
            const selected = selectedRowId && params.id === selectedRowId ? 'selected-row' : '';
            const extra = rowClassName ? rowClassName(params.row as T) : '';
            return [extra, selected].filter(Boolean).join(' ');
          }}
          {...detailPanelProps}
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover',
            },
            '& .MuiDataGrid-row.selected-row': {
              backgroundColor: 'primary.light',
              '&:hover': {
                backgroundColor: 'primary.main',
              },
            },
            // Due-date / schedule gradient classes
            '& .MuiDataGrid-row.row-late, & .MuiDataGrid-row.row-late:hover': {
              backgroundColor: (theme) => alpha(theme.palette.error.main, 0.24),
            },
            '& .MuiDataGrid-row.row-due-0, & .MuiDataGrid-row.row-due-0:hover': {
              backgroundColor: (theme) => alpha(theme.palette.error.main, 0.20),
            },
            '& .MuiDataGrid-row.row-due-1, & .MuiDataGrid-row.row-due-1:hover': {
              backgroundColor: (theme) => alpha(theme.palette.error.main, 0.16),
            },
            '& .MuiDataGrid-row.row-due-2, & .MuiDataGrid-row.row-due-2:hover': {
              backgroundColor: (theme) => alpha(theme.palette.error.main, 0.12),
            },
            '& .MuiDataGrid-row.row-due-3, & .MuiDataGrid-row.row-due-3:hover': {
              backgroundColor: (theme) => alpha(theme.palette.error.main, 0.08),
            },
            '& .MuiDataGrid-row.row-due-4, & .MuiDataGrid-row.row-due-4:hover': {
              backgroundColor: (theme) => alpha(theme.palette.error.main, 0.04),
            },
          }}
        />
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={40} />
              <Typography
                variant="body2"
                sx={{ mt: 1, color: 'text.secondary' }}
              >
                Loading data...
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Form Modal */}
      {renderForm && (
        <Dialog
          open={formOpen}
          onClose={handleFormClose}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              margin: { xs: 2, sm: 'auto' },
              width: { xs: 'calc(100% - 32px)', sm: 'auto' },
            },
          }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {formMode === 'create' ? `Create ${title}` : `Edit ${title}`}
            <IconButton onClick={handleFormClose} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {renderForm({
              open: formOpen,
              onClose: handleFormSuccess,
              initialValues: editingRow ? { ...editingRow } : {},
              mode: formMode,
            })}
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
}

// Export common column definitions for reuse
export const commonColumns = {
  activeFlag: {
    field: 'active_flag',
    headerName: 'Status',
    width: 120,
    renderCell: renderActiveFlag,
  },
  createdAt: {
    field: 'created_at',
    headerName: 'Created',
    width: 120,
    renderCell: renderDate,
  },
  createdBy: {
    field: 'created_by',
    headerName: 'Created By',
    width: 150,
    renderCell: renderCreatedBy,
  },
  updatedAt: {
    field: 'updated_at',
    headerName: 'Updated',
    width: 120,
    renderCell: renderDate,
  },
  updatedBy: {
    field: 'updated_by',
    headerName: 'Updated By',
    width: 150,
    renderCell: renderUpdatedBy,
  },
};
