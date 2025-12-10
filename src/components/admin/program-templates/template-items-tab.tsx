'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import BaseDataTable, {
  renderActiveFlag,
} from '@/components/tables/base-data-table';
import { ProgramTemplate, ProgramTemplateItems } from '@/types/database.types';
import {
  useProgramTemplateItems,
  useCreateProgramTemplateItem,
  useUpdateProgramTemplateItem,
  useDeleteProgramTemplateItem,
} from '@/lib/hooks/use-program-template-items';
import { useTherapies } from '@/lib/hooks/use-therapies';
import { useProgramTemplate } from '@/lib/hooks/use-program-templates';
import AddTemplateItemForm from './add-template-item-form';

interface TemplateItemsTabProps {
  template: ProgramTemplate;
  onTemplateUpdate: (template: ProgramTemplate) => void;
}

export default function TemplateItemsTab({
  template,
  onTemplateUpdate,
}: TemplateItemsTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgramTemplateItems | null>(
    null
  );
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ProgramTemplateItems | null>(
    null
  );

  const {
    data: templateItems = [],
    isLoading,
    error,
  } = useProgramTemplateItems(template.program_template_id);
  const { data: therapies = [] } = useTherapies();
  const { data: updatedTemplate } = useProgramTemplate(
    template.program_template_id
  );
  const createItem = useCreateProgramTemplateItem();
  const updateItem = useUpdateProgramTemplateItem();
  const deleteItem = useDeleteProgramTemplateItem();

  // Update parent component when template data changes
  React.useEffect(() => {
    if (updatedTemplate) {
      onTemplateUpdate(updatedTemplate);
    }
  }, [updatedTemplate, onTemplateUpdate]);

  // Map template items to include id field for DataGrid
  const mappedTemplateItems = templateItems.map(item => ({
    ...item,
    id: item.program_template_items_id,
    // Flatten nested data for sorting
    therapy_type_name:
      (item as any).therapies?.therapytype?.therapy_type_name || 'N/A',
    therapy_name: (item as any).therapies?.therapy_name || 'Unknown Therapy',
    bucket_name: (item as any).therapies?.buckets?.bucket_name || 'N/A',
    therapy_cost: (item as any).therapies?.cost || 0,
    therapy_charge: (item as any).therapies?.charge || 0,
    total_cost: ((item as any).therapies?.cost || 0) * (item.quantity || 1),
    total_charge: ((item as any).therapies?.charge || 0) * (item.quantity || 1),
  }));


  const handleAddItem = async (formData: {
    therapy_type_id?: number;
    therapy_id: number;
    quantity: number;
    days_from_start: number;
    days_between: number;
    active_flag: boolean;
    instructions?: string | undefined;
  }) => {
    try {
      await createItem.mutateAsync({
        program_template_id: template.program_template_id,
        ...formData,
      });
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding template item:', error);
    }
  };

  const handleDeleteItem = (item: ProgramTemplateItems) => {
    setDeletingItem(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!deletingItem) return;

    try {
      await deleteItem.mutateAsync({
        templateId: template.program_template_id,
        itemId: deletingItem.program_template_items_id,
      });
      setIsDeleteModalOpen(false);
      setDeletingItem(null);
    } catch (error) {
      console.error('Error deleting template item:', error);
    }
  };

  const handleEditItem = (item: ProgramTemplateItems) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async (formData: {
    therapy_type_id?: number;
    therapy_id: number;
    quantity: number;
    days_from_start: number;
    days_between: number;
    active_flag: boolean;
    instructions?: string | undefined;
  }) => {
    if (!editingItem) return;

    try {
      await updateItem.mutateAsync({
        templateId: template.program_template_id,
        itemId: editingItem.program_template_items_id,
        data: formData,
      });
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating template item:', error);
    }
  };

  const columns: any[] = [
    {
      field: 'therapy_type_name',
      headerName: 'Therapy Type',
      width: 150,
    },
    {
      field: 'therapy_name',
      headerName: 'Therapy Name',
      width: 200,
    },
    {
      field: 'bucket_name',
      headerName: 'Bucket',
      width: 120,
    },
    {
      field: 'active_flag',
      headerName: 'Flag',
      width: 120,
      renderCell: renderActiveFlag,
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 100,
      type: 'number',
    },
    {
      field: 'days_from_start',
      headerName: 'Days From Start',
      width: 150,
      type: 'number',
    },
    {
      field: 'days_between',
      headerName: 'Days Between',
      width: 130,
      type: 'number',
    },
    {
      field: 'instructions',
      headerName: 'Instructions',
      width: 250,
    },
    {
      field: 'total_cost',
      headerName: 'Cost',
      width: 100,
      type: 'number',
      renderCell: (params: any) => {
        const value = params.value || 0;
        return `$${value.toFixed(2)}`;
      },
    },
    {
      field: 'total_charge',
      headerName: 'Charge',
      width: 100,
      type: 'number',
      renderCell: (params: any) => {
        const value = params.value || 0;
        return `$${value.toFixed(2)}`;
      },
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsAddModalOpen(true)}
          sx={{
            borderRadius: 0,
            fontWeight: 600,
          }}
        >
          Add Item
        </Button>
      </Box>

      <BaseDataTable<any>
        title=""
        data={mappedTemplateItems}
        columns={columns}
        loading={isLoading}
        getRowId={row => row.program_template_items_id}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={5}
        pageSizeOptions={[5, 10, 25]}
        autoHeight={true}
        sortModel={[{ field: 'therapy_name', sort: 'asc' }]}
      />

      {/* Add Item Modal */}
      <Dialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        maxWidth="md"
        fullWidth={false}
        PaperProps={{
          sx: {
            width: '675px',
            maxWidth: '90vw',
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
          Add Item to Template
          <IconButton onClick={() => setIsAddModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <AddTemplateItemForm
            therapies={therapies}
            onSave={handleAddItem}
            onCancel={() => setIsAddModalOpen(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Item Modal */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        maxWidth="md"
        fullWidth={false}
        PaperProps={{
          sx: {
            width: '675px',
            maxWidth: '90vw',
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
          Edit Template Item
          <IconButton
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingItem(null);
            }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {editingItem && (
            <AddTemplateItemForm
              therapies={therapies}
              onSave={handleUpdateItem}
              onCancel={() => {
                setIsEditModalOpen(false);
                setEditingItem(null);
              }}
              initialValues={{
                therapy_type_id:
                  (editingItem as any).therapies?.therapy_type_id || 0,
                therapy_id: editingItem.therapy_id || 0,
                program_role_id: (editingItem as any).program_role_id || null,
                quantity: editingItem.quantity || 1,
                days_from_start: editingItem.days_from_start || 0,
                days_between: editingItem.days_between || 0,
                active_flag: editingItem.active_flag ?? true,
                instructions: (editingItem as any).instructions || '',
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
            Are you sure you want to remove this item from the template?
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
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
