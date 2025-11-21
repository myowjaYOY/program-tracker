'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  GridFooterContainer,
  GridFooter,
  useGridApiRef,
} from '@mui/x-data-grid-pro';
import { useAuth } from '@/lib/hooks/useAuth';

// Custom aggregation model type (not from MUI - we calculate manually)
type AggregationModel = Record<string, 'sum' | 'avg' | 'min' | 'max' | 'size'>;
import { alpha } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// Using built-in toolbar via showToolbar prop

// Custom Footer Component for Aggregation
function CustomAggregationFooter({
  data,
  columns,
  aggregationModel,
  aggregationLabel,
}: {
  data: any[];
  columns: GridColDef[];
  aggregationModel?: AggregationModel;
  aggregationLabel?: string;
}) {
  if (!aggregationModel || Object.keys(aggregationModel).length === 0) {
    return <GridFooter />;
  }

  // Calculate aggregations
  const aggregations: Record<string, number> = {};
  Object.keys(aggregationModel).forEach(field => {
    const aggType = aggregationModel[field];
    const values = data.map(row => Number(row[field]) || 0).filter(v => !isNaN(v));
    
    if (aggType === 'sum') {
      aggregations[field] = values.reduce((sum, val) => sum + val, 0);
    } else if (aggType === 'avg') {
      aggregations[field] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    } else if (aggType === 'min') {
      aggregations[field] = values.length > 0 ? Math.min(...values) : 0;
    } else if (aggType === 'max') {
      aggregations[field] = values.length > 0 ? Math.max(...values) : 0;
    } else if (aggType === 'size') {
      aggregations[field] = values.length;
    }
  });

  return (
    <GridFooterContainer sx={{ justifyContent: 'space-between' }}>
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {Object.keys(aggregations).map(field => {
          const column = columns.find(col => col.field === field);
          const value = aggregations[field];
          if (value === undefined) return null;
          
          // Format the aggregated value
          let formattedValue: string | number = value;
          if (column?.valueFormatter && typeof column.valueFormatter === 'function') {
            try {
              // Call valueFormatter with required MUI signature (value, row, column, apiRef)
              const formatted = (column.valueFormatter as any)(value, {} as any, column as any, {} as any);
              if (formatted !== undefined) {
                formattedValue = formatted;
              }
            } catch {
              // Fallback if formatter fails
              formattedValue = value;
            }
          }
          
          return (
            <Typography key={field} variant="body2" fontWeight="bold" sx={{ mr: 3, whiteSpace: 'nowrap' }}>
              {aggregationLabel || 'Total:'} {formattedValue}
            </Typography>
          );
        })}
      </Box>
      <Box sx={{ flexShrink: 0, minWidth: 0 }}>
        <GridFooter />
      </Box>
    </GridFooterContainer>
  );
}

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
  if (!params || !params.value)
    return <Typography variant="body2">-</Typography>;
  const v = params.value as string;
  // If value is a date-only string (YYYY-MM-DD), avoid UTC parsing shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    const local = new Date(y ?? 2024, (m ?? 1) - 1, d ?? 1);
    return (
      <Typography variant="body2">
        {local.toLocaleDateString('en-US')}
      </Typography>
    );
  }
  return (
    <Typography variant="body2">
      {new Date(v).toLocaleDateString('en-US')}
    </Typography>
  );
};

export const renderDateTime = (params: GridRenderCellParams) => (
  <Typography variant="body2">
    {params.value ? new Date(params.value).toLocaleString('en-US') : '-'}
  </Typography>
);

export const renderCreatedBy = (params: GridRenderCellParams) => (
  <Typography variant="body2">{(params && params.value) || '-'}</Typography>
);

export const renderUpdatedBy = (params: GridRenderCellParams) => (
  <Typography variant="body2">{(params && params.value) || '-'}</Typography>
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
  // Initial sort model
  sortModel?: Array<{ field: string; sort: 'asc' | 'desc' }>;
  // Export functionality
  enableExport?: boolean;
  // Aggregation functionality (optional, backward-compatible)
  aggregationModel?: AggregationModel;
  showAggregationFooter?: boolean;
  aggregationLabel?: string;
  // State persistence (optional)
  persistStateKey?: string;
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
  sortModel,
  enableExport = false,
  aggregationModel,
  showAggregationFooter = false,
  aggregationLabel,
  persistStateKey,
}: BaseDataTableProps<T>) {
  
  // Get user for per-user state persistence
  const { user } = useAuth();
  
  // Create API reference for state persistence
  const apiRef = useGridApiRef();
  
  // Load saved state from localStorage BEFORE rendering
  // CRITICAL: Must wait for user to be loaded before computing state
  const initialGridState = useMemo(() => {
    // If we have persistStateKey but no user yet, return null to signal "not ready"
    if (persistStateKey && !user?.id) {
      return null; // null = waiting for user, undefined = no saved state
    }
    
    // No persistence needed
    if (!persistStateKey || !user?.id) {
      return undefined;
    }
    
    const storageKey = `${persistStateKey}_${user.id}`;
    const savedState = localStorage.getItem(storageKey);
    
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (error) {
        console.error(`Failed to parse grid state for ${persistStateKey}:`, error);
        localStorage.removeItem(storageKey);
        return undefined;
      }
    }
    
    return undefined;
  }, [persistStateKey, user?.id]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<T | undefined>(undefined);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [expandedRow, setExpandedRow] = useState<GridRowId | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<GridRowId | null>(null);

  // STATE PERSISTENCE - Save state on exit (unmount or browser close)
  // Inject saved widths directly into columns to prevent flash
  const columnsWithSavedWidths = useMemo(() => {
    if (!initialGridState?.columns?.dimensions) return columns;
    
    const savedDimensions = initialGridState.columns.dimensions;
    
    return columns.map(col => {
      const savedDim = savedDimensions[col.field];
      if (savedDim?.width) {
        return { ...col, width: savedDim.width };
      }
      return col;
    });
  }, [columns, initialGridState]);
  
  useEffect(() => {
    // Capture apiRef at effect time, not cleanup time
    const apiRefCurrent = apiRef.current;
    const currentPersistKey = persistStateKey;
    const currentUserId = user?.id;
    
    // Save on unmount (SPA navigation)
    return () => {
      if (!currentPersistKey || !currentUserId || !apiRefCurrent) return;
      
      const storageKey = `${currentPersistKey}_${currentUserId}`;
      try {
        const newState = apiRefCurrent.exportState();
        
        // Merge with existing saved dimensions to preserve manually resized columns
        const existingSaved = localStorage.getItem(storageKey);
        if (existingSaved) {
          try {
            const existingState = JSON.parse(existingSaved);
            if (existingState.columns?.dimensions) {
              // Merge existing dimensions with new ones (new ones take precedence)
              newState.columns = newState.columns || {};
              newState.columns.dimensions = {
                ...existingState.columns.dimensions,
                ...newState.columns.dimensions,
              };
            }
          } catch (e) {
            // Silently ignore merge errors
          }
        }
        
        localStorage.setItem(storageKey, JSON.stringify(newState));
      } catch (error) {
        console.error(`Failed to save grid state for ${currentPersistKey}:`, error);
      }
    };
  }, [persistStateKey, user?.id, apiRef]);

  useEffect(() => {
    // Save on browser close/refresh
    if (!persistStateKey || !user?.id) return;
    
    const storageKey = `${persistStateKey}_${user.id}`;
    const apiRefCurrent = apiRef.current;
    
    const handleBeforeUnload = () => {
      if (apiRefCurrent) {
        try {
          const newState = apiRefCurrent.exportState();
          
          // Merge with existing saved dimensions
          const existingSaved = localStorage.getItem(storageKey);
          if (existingSaved) {
            try {
              const existingState = JSON.parse(existingSaved);
              if (existingState.columns?.dimensions) {
                newState.columns = newState.columns || {};
                newState.columns.dimensions = {
                  ...existingState.columns.dimensions,
                  ...newState.columns.dimensions,
                };
              }
            } catch (e) {
              // Silently ignore merge errors
            }
          }
          
          localStorage.setItem(storageKey, JSON.stringify(newState));
        } catch (error) {
          console.error(`Failed to save grid state for ${persistStateKey}:`, error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [persistStateKey, user?.id, apiRef]);

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

  // All columns including actions (with saved widths injected to prevent flash)
  const allColumns = useMemo(() => {
    if (showActionsColumn) {
      return [...columnsWithSavedWidths, actionsColumn];
    }
    return columnsWithSavedWidths;
  }, [columnsWithSavedWidths, actionsColumn, showActionsColumn]);

  // Handle edit
  const handleEdit = (row: T) => {
    setEditingRow(row);
    setFormMode('edit');
    setFormOpen(true);
  };

  // Handle delete - open confirmation modal
  const handleDelete = (id: GridRowId) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  // Confirm delete - actual deletion
  const confirmDelete = () => {
    if (deletingId !== null) {
      onDelete?.(deletingId);
      setDeleteModalOpen(false);
      setDeletingId(null);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteModalOpen(false);
    setDeletingId(null);
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
          height: autoHeight
            ? 'auto'
            : gridHeight || { xs: 400, sm: 500, md: 600 },
          width: '100%',
          position: autoHeight ? 'static' : 'relative',
        }}
      >
        {/* Wait for user to load before rendering grid (prevents initialState race condition) */}
        {persistStateKey && initialGridState === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
            <CircularProgress size={40} />
          </Box>
        ) : (
          <DataGridPro
            key={persistStateKey && user?.id ? `${persistStateKey}_${user.id}` : 'grid'}
            apiRef={apiRef}
            rows={data}
            columns={allColumns}
            loading={loading}
            rowHeight={40}
            autoHeight={autoHeight}
            getRowId={getRowId || (row => row.id)}
            pagination={true}
            showToolbar={enableExport}
            initialState={{
              ...initialGridState,
              pagination: initialGridState?.pagination || {
                paginationModel: { page: 0, pageSize },
              },
              // Only apply prop sortModel if no saved state exists
              ...(!initialGridState?.sorting && sortModel && { sorting: { sortModel } }),
            }}
          {...(!initialGridState?.sorting && sortModel && { initialSortModel: sortModel })}
          pageSizeOptions={pageSizeOptions}
          {...(onRowClick && {
            onRowClick: (params: any) => onRowClick(params.row),
          })}
          {...(showAggregationFooter && aggregationModel && {
            slots: {
              footer: CustomAggregationFooter as any,
            },
            slotProps: {
              footer: { data, columns: allColumns, aggregationModel, aggregationLabel } as any,
            },
          })}
          getRowClassName={params => {
            const selected =
              selectedRowId && params.id === selectedRowId
                ? 'selected-row'
                : '';
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
              backgroundColor: theme => alpha(theme.palette.error.main, 0.24),
            },
            '& .MuiDataGrid-row.row-due-0, & .MuiDataGrid-row.row-due-0:hover':
              {
                backgroundColor: theme => alpha(theme.palette.error.main, 0.2),
              },
            '& .MuiDataGrid-row.row-due-1, & .MuiDataGrid-row.row-due-1:hover':
              {
                backgroundColor: theme => alpha(theme.palette.error.main, 0.16),
              },
            '& .MuiDataGrid-row.row-due-2, & .MuiDataGrid-row.row-due-2:hover':
              {
                backgroundColor: theme => alpha(theme.palette.error.main, 0.12),
              },
            '& .MuiDataGrid-row.row-due-3, & .MuiDataGrid-row.row-due-3:hover':
              {
                backgroundColor: theme => alpha(theme.palette.error.main, 0.08),
              },
            '& .MuiDataGrid-row.row-due-4, & .MuiDataGrid-row.row-due-4:hover':
              {
                backgroundColor: theme => alpha(theme.palette.error.main, 0.04),
              },
          }}
        />
        )}
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

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={cancelDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Delete
          <IconButton
            onClick={cancelDelete}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography>{deleteConfirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
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
