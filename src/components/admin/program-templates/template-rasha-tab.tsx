'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Card,
  CardContent,
  Typography,
  Grid,
  Tooltip,
  Chip,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import BaseDataTable, {
  renderActiveFlag,
} from '@/components/tables/base-data-table';
import { ProgramTemplate, ProgramTemplateRasha } from '@/types/database.types';
import { ProgramTemplateRashaFormData } from '@/lib/validations/program-template-rasha';
import {
  useProgramTemplateRashaItems,
  useCreateProgramTemplateRashaItem,
  useUpdateProgramTemplateRashaItem,
  useDeleteProgramTemplateRashaItem,
} from '@/lib/hooks/use-program-template-rasha';
import { useRashaLists } from '@/lib/hooks/use-rasha-list';
import AddTemplateRashaForm from './add-template-rasha-form';

interface TemplateRashaTabProps {
  template: ProgramTemplate;
}

export default function TemplateRashaTab({ template }: TemplateRashaTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgramTemplateRasha | null>(
    null
  );
  const [deletingItem, setDeletingItem] = useState<ProgramTemplateRasha | null>(
    null
  );

  const {
    data: rashaItems = [],
    isLoading,
    error,
  } = useProgramTemplateRashaItems(template.program_template_id);
  const { data: rashaList = [] } = useRashaLists();
  const createItem = useCreateProgramTemplateRashaItem();
  const updateItem = useUpdateProgramTemplateRashaItem();
  const deleteItem = useDeleteProgramTemplateRashaItem();

  // Map RASHA items to include id field for DataGrid and ensure non-null dates
  const mappedRashaItems = rashaItems.map(item => ({
    ...item,
    id: item.program_template_rasha_id,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString(),
  }));

  // Calculate group summaries (only active items)
  const groupSummaries = useMemo(() => {
    const activeItems = rashaItems.filter(item => item.active_flag);
    const groups = new Map<string, { items: typeof rashaItems; totalSeconds: number }>();

    activeItems.forEach(item => {
      const groupName = item.group_name || 'No Group';
      if (!groups.has(groupName)) {
        groups.set(groupName, { items: [], totalSeconds: 0 });
      }
      const group = groups.get(groupName)!;
      group.items.push(item);
      group.totalSeconds += item.rasha_length || 0;
    });

    return Array.from(groups.entries())
      .map(([name, data]) => ({
        name,
        totalSeconds: data.totalSeconds,
        items: data.items,
      }))
      .sort((a, b) => {
        // "No Group" always comes last
        if (a.name === 'No Group') return 1;
        if (b.name === 'No Group') return -1;
        // Otherwise sort alphabetically
        return a.name.localeCompare(b.name);
      });
  }, [rashaItems]);

  // Format seconds to HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  // Color palette for group cards - returns actual color values
  const colorPalette = [
    '#8e24ff',  // Primary purple
    '#0288d1',  // Info blue
    '#2e7d32',  // Success green
    '#ed6c02',  // Warning orange
    '#d32f2f',  // Error red
    '#5a0ea4',  // Secondary dark purple
  ];

  // Get consistent color for a group name using simple hash
  const getGroupColor = (groupName: string): string => {
    if (groupName === 'No Group') return '#9e9e9e'; // Neutral grey for "No Group"
    
    // Simple hash function for consistent color assignment
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) {
      hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colorPalette.length;
    return colorPalette[index]!; // Index is always valid due to modulo
  };

  // Detect type mismatches within each group
  const getTypeMismatchInfo = (item: typeof rashaItems[0]) => {
    if (!item.group_name) return null; // No group, no mismatch possible

    const groupItems = rashaItems.filter(
      i => i.group_name === item.group_name && i.active_flag
    );

    if (groupItems.length <= 1) return null; // Only one item, no mismatch

    const groupTypes = groupItems.filter(i => i.type === 'group').length;
    const individualTypes = groupItems.filter(i => i.type === 'individual').length;

    // Majority is 'group', but this item is 'individual'
    if (groupTypes > individualTypes && item.type === 'individual') {
      return {
        isOutlier: true,
        message: `Type mismatch: ${groupTypes} item${groupTypes !== 1 ? 's' : ''} in "${item.group_name}" are "Group" type, but this one is "Individual".`,
      };
    }

    // 50/50 split or majority is 'individual', highlight 'individual' anyway
    if (groupTypes === individualTypes && item.type === 'individual') {
      return {
        isOutlier: true,
        message: `Type mismatch: Equal split in "${item.group_name}" - ${groupTypes} "Group" and ${individualTypes} "Individual". Consider making all items the same type.`,
      };
    }

    // Majority is 'individual', but this item is 'group' (rare case)
    if (individualTypes > groupTypes && item.type === 'group') {
      return {
        isOutlier: true,
        message: `Type mismatch: ${individualTypes} item${individualTypes !== 1 ? 's' : ''} in "${item.group_name}" are "Individual" type, but this one is "Group".`,
      };
    }

    return null;
  };

  const handleAddItem = async (formData: ProgramTemplateRashaFormData) => {
    try {
      const { program_template_id, ...restData } = formData;
      await createItem.mutateAsync({
        program_template_id: template.program_template_id,
        ...restData,
        group_name: restData.group_name || null,
      });
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding template RASHA item:', error);
    }
  };

  const handleDeleteItem = async (item: ProgramTemplateRasha) => {
    setDeletingItem(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      await deleteItem.mutateAsync({
        templateId: template.program_template_id,
        rashaId: deletingItem.program_template_rasha_id,
      });
      setIsDeleteModalOpen(false);
      setDeletingItem(null);
    } catch (error) {
      console.error('Error deleting template RASHA item:', error);
    }
  };

  const handleEditItem = (item: ProgramTemplateRasha) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async (formData: ProgramTemplateRashaFormData) => {
    if (!editingItem) return;

    try {
      const { program_template_id, ...updateData } = formData;
      await updateItem.mutateAsync({
        templateId: template.program_template_id,
        rashaId: editingItem.program_template_rasha_id,
        data: {
          ...updateData,
          group_name: updateData.group_name || null,
        },
      });
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating template RASHA item:', error);
    }
  };

  const columns: any[] = [
    {
      field: 'rasha_name',
      headerName: 'RASHA Name',
      width: 200,
      flex: 1,
    },
    {
      field: 'rasha_length',
      headerName: 'Length',
      width: 100,
      type: 'number',
    },
    {
      field: 'group_name',
      headerName: 'Group Name',
      width: 150,
      renderCell: (params: any) => params.value || '-',
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      renderCell: (params: any) => {
        const item = params.row;
        const type = params.value;
        const mismatchInfo = getTypeMismatchInfo(item);
        
        if (mismatchInfo?.isOutlier) {
          return (
            <Tooltip title={mismatchInfo.message} arrow>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WarningIcon sx={{ color: 'error.main', fontSize: 20 }} />
                <Typography variant="body2">
                  {type === 'group' ? 'Group' : 'Individual'}
                </Typography>
              </Box>
            </Tooltip>
          );
        }
        
        return type === 'group' ? 'Group' : 'Individual';
      },
    },
    {
      field: 'order_number',
      headerName: 'Order',
      width: 80,
      type: 'number',
    },
    {
      field: 'active_flag',
      headerName: 'Flag',
      width: 100,
      renderCell: renderActiveFlag,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: any) => {
        if (!params?.row) return null;
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={() => handleEditItem(params.row)}
              color="primary"
              size="small"
            >
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={() => handleDeleteItem(params.row)}
              color="error"
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      {/* Group Summary Cards with Add Button */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          {groupSummaries.map(group => {
            const groupColor = getGroupColor(group.name);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 2 }} key={group.name}>
                <Card 
                  sx={{ 
                    height: '100%',
                    borderTop: `4px solid ${groupColor}`,
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme => theme.shadows[4],
                    },
                  }}
                >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {group.name === 'No Group' ? (
                      <PersonIcon color="action" fontSize="small" />
                    ) : (
                      <GroupIcon color="primary" fontSize="small" />
                    )}
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        fontWeight: 600,
                        color: group.name === 'No Group' ? 'text.secondary' : 'text.primary',
                        flexShrink: 0,
                      }}
                    >
                      {group.name}
                    </Typography>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        fontWeight: 700,
                        color: 'primary.main',
                        fontFamily: 'monospace',
                        ml: 'auto',
                      }}
                    >
                      {formatDuration(group.totalSeconds)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
          })}
          
          {/* Add Button - aligned to bottom right of row */}
          <Grid 
            size={{ xs: 12, sm: 6, md: groupSummaries.length === 0 ? 12 : 'grow' }} 
            sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}
          >
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setIsAddModalOpen(true)}
              sx={{ borderRadius: 0 }}
            >
              Add RASHA Item
            </Button>
          </Grid>
        </Grid>
      </Box>

      <BaseDataTable
        title=""
        data={mappedRashaItems}
        columns={columns}
        loading={isLoading}
        error={error?.message || null}
        getRowId={row => row.program_template_rasha_id}
        pageSize={10}
        pageSizeOptions={[5, 10, 25, 50]}
        autoHeight={true}
        showActionsColumn={false}
        sortModel={[
          { field: 'group_name', sort: 'asc' },
          { field: 'order_number', sort: 'asc' }
        ]}
      />

      {/* Add Modal */}
      <Dialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add RASHA Item to Template
          <IconButton
            onClick={() => setIsAddModalOpen(false)}
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
          <AddTemplateRashaForm
            rashaItems={rashaList}
            onSave={handleAddItem}
            onCancel={() => setIsAddModalOpen(false)}
            initialValues={{
              program_template_id: template.program_template_id,
            }}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit RASHA Item
          <IconButton
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingItem(null);
            }}
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
          {editingItem && (
            <AddTemplateRashaForm
              rashaItems={rashaList}
              onSave={handleUpdateItem}
              onCancel={() => {
                setIsEditModalOpen(false);
                setEditingItem(null);
              }}
              initialValues={{
                program_template_id: editingItem.program_template_id,
                rasha_list_id: editingItem.rasha_list_id,
                group_name: editingItem.group_name,
                type: editingItem.type,
                order_number: editingItem.order_number,
                active_flag: editingItem.active_flag,
              }}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingItem(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Delete
          <IconButton
            onClick={() => {
              setIsDeleteModalOpen(false);
              setDeletingItem(null);
            }}
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
          <Typography>
            Are you sure you want to remove this RASHA item from the template? This
            action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsDeleteModalOpen(false);
              setDeletingItem(null);
            }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteItem}
            color="error"
            variant="contained"
            disabled={deleteItem.isPending}
          >
            {deleteItem.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

