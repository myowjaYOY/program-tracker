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
  Chip,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import FormStatus from '@/components/ui/FormStatus';
import BaseDataTable from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms, MemberProgramItems } from '@/types/database.types';
import { MemberProgramItemFormData } from '@/lib/validations/member-program-item';
import {
  useMemberProgramItems,
  useCreateMemberProgramItem,
  useUpdateMemberProgramItem,
  useDeleteMemberProgramItem,
} from '@/lib/hooks/use-member-program-items';
import { useTherapies } from '@/lib/hooks/use-therapies';
import { useQueryClient } from '@tanstack/react-query';
import { memberProgramItemKeys } from '@/lib/hooks/use-member-program-items';
import { memberProgramItemTaskKeys } from '@/lib/hooks/use-member-program-item-tasks';
import { useMemberProgram } from '@/lib/hooks/use-member-programs';
import { useMemberProgramFinances } from '@/lib/hooks/use-member-program-finances';
import { useMemberProgramPayments } from '@/lib/hooks/use-member-program-payments';
import { formatCurrency } from '@/lib/utils/money';
import AddProgramItemForm from './add-program-item-form';
import useFinancialsLock from '@/lib/hooks/use-financials-lock';
import { useProgramStatus } from '@/lib/hooks/use-program-status';
import { todoKeys } from '@/lib/hooks/use-program-todo';

interface ProgramItemsTabProps {
  program: MemberPrograms;
  onProgramUpdate: (program: MemberPrograms) => void;
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
}

// Extended interface for items with joined therapy data
interface ProgramItemWithTherapy extends MemberProgramItems {
  id: number;
  therapies: {
    therapy_name: string;
    cost: number | null;
    charge: number | null;
    therapy_type_id: number | null;
    active_flag: boolean;
    taxable: boolean;
    therapytype: {
      therapy_type_name: string;
    };
    buckets: {
      bucket_name: string;
    };
  };
}

export default function ProgramItemsTab({
  program,
  onProgramUpdate,
  onUnsavedChangesChange,
}: ProgramItemsTabProps) {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MemberProgramItems | null>(
    null
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [modalValidationError, setModalValidationError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MemberProgramItems | null>(
    null
  );

  const { data: programItems = [], isLoading } = useMemberProgramItems(
    program.member_program_id
  );
  const { data: therapies = [] } = useTherapies();
  const { data: updatedProgram, refetch: refetchProgram } = useMemberProgram(
    program.member_program_id
  );
  const createItem = useCreateMemberProgramItem();
  const updateItem = useUpdateMemberProgramItem();
  const deleteItem = useDeleteMemberProgramItem();
  const { data: finances } = useMemberProgramFinances(
    program.member_program_id
  );
  const { data: freshProgram } = useMemberProgram(program.member_program_id);
  const { data: statuses = [] } = useProgramStatus();
  const statusName = (
    statuses.find(
      s =>
        s.program_status_id ===
        (freshProgram?.program_status_id ?? program.program_status_id)
    )?.status_name || ''
  ).toLowerCase();
  const readOnlyAll =
    statusName === 'paused' ||
    statusName === 'completed' ||
    statusName === 'cancelled';

  // Update parent component when program data changes
  React.useEffect(() => {
    if (updatedProgram) {
      onProgramUpdate(updatedProgram);
    }
  }, [updatedProgram, onProgramUpdate]);

  // Map program items to include id field for DataGrid and cast to extended type
  const mappedProgramItems = programItems.map(item => ({
    ...item,
    id: item.member_program_item_id,
    // Flatten nested data for sorting
    therapy_type_name: item.therapies?.therapytype?.therapy_type_name || 'N/A',
    therapy_name: item.therapies?.therapy_name || 'Unknown Therapy',
    bucket_name: item.therapies?.buckets?.bucket_name || 'N/A',
    therapy_cost: item.therapies?.cost || 0,
    therapy_charge: item.therapies?.charge || 0,
    therapy_taxable: (item.therapies as any)?.taxable || false,
    total_cost: (item.item_cost || 0) * (item.quantity || 1),
    total_charge: (item.item_charge || 0) * (item.quantity || 1),
  })) as unknown as ProgramItemWithTherapy[];

  const handleAddItem = async (formData: MemberProgramItemFormData) => {
    try {
      setValidationError(null);
      setModalValidationError(null);
      await createItem.mutateAsync({
        member_program_id: program.member_program_id,
        therapy_id: formData.therapy_id,
        quantity: formData.quantity,
        days_from_start: formData.days_from_start,
        days_between: formData.days_between,
        instructions: formData.instructions ?? null,
      });
      setIsAddModalOpen(false);
    } catch (error: any) {
      // Only show non-validation errors on the tab
      // Validation errors (400) should only show in the modal
      const isValidationError = error?.status === 400 || error?.response?.status === 400;
      if (isValidationError) {
        setModalValidationError(error?.message || 'Validation failed');
      } else {
        setValidationError(error?.message || 'Failed to add item');
      }
      // Don't re-throw - let the form handle it gracefully
    }
  };

  const handleDeleteItem = (item: MemberProgramItems) => {
    setDeletingItem(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!deletingItem) return;

    try {
      setValidationError(null);
      setModalValidationError(null);
      await deleteItem.mutateAsync({
        programId: program.member_program_id,
        itemId: deletingItem.member_program_item_id,
      });
      setIsDeleteModalOpen(false);
      setDeletingItem(null);
    } catch (error: any) {
      // Only show non-validation errors on the tab
      const isValidationError = error?.status === 400 || error?.response?.status === 400;
      if (isValidationError) {
        setModalValidationError(error?.message || 'Validation failed');
      } else {
        setValidationError(error?.message || 'Failed to delete item');
      }
    }
  };

  const handleEditItem = (item: MemberProgramItems) => {
    setEditingItem(item);
    setModalValidationError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async (formData: MemberProgramItemFormData) => {
    if (!editingItem) return;

    try {
      setValidationError(null);
      setModalValidationError(null);
      await updateItem.mutateAsync({
        programId: program.member_program_id,
        itemId: editingItem.member_program_item_id,
        data: {
          therapy_id: formData.therapy_id,
          quantity: formData.quantity,
          days_from_start: formData.days_from_start,
          days_between: formData.days_between,
          instructions: formData.instructions ?? null,
        },
      });
      setIsEditModalOpen(false);
      setEditingItem(null);
      } catch (error: any) {
        // Only show non-validation errors on the tab
        // Validation errors (400) should only show in the modal
        const isValidationError = error?.status === 400 || error?.response?.status === 400;
        if (isValidationError) {
          setModalValidationError(error?.message || 'Validation failed');
        } else {
          setValidationError(error?.message || 'Failed to update item');
        }
        // Don't re-throw - let the form handle it gracefully
      }
  };

  type ProgramItemRow = ProgramItemWithTherapy & {
    therapy_type_name: string;
    therapy_name: string;
    bucket_name: string;
    therapy_cost: number;
    therapy_charge: number;
    total_cost: number;
    total_charge: number;
  };

  const columns: GridColDef<ProgramItemRow>[] = [
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
      field: 'quantity',
      headerName: 'Quantity',
      width: 120,
      type: 'number',
      renderCell: (params: any) => {
        const total = Number(params.value || 0);
        const used = Number(params.row.used_count || 0);
        const label = `${total}`;
        const color =
          used === 0 ? 'default' : used < total ? 'success' : 'error';
        const title = used === 0 ? 'No items used' : `${used} of ${total} used`;
        return (
          <Chip
            label={label}
            color={color as any}
            size="small"
            variant={color === 'default' ? 'outlined' : 'filled'}
            title={title}
          />
        );
      },
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
      renderCell: params => formatCurrency(Number(params.value || 0)),
    },
    {
      field: 'total_charge',
      headerName: 'Charge',
      width: 100,
      type: 'number',
      renderCell: params => formatCurrency(Number(params.value || 0)),
    },
    {
      field: 'therapy_taxable',
      headerName: 'Taxable',
      width: 80,
      type: 'boolean',
      renderCell: (params: any) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'primary' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: params => {
        if (!params?.row) return null;
        const actionsDisabled = readOnlyAll;
        const usedCount = Number((params as any).row?.used_count || 0);
        const deleteDisabled = actionsDisabled || usedCount > 0;
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={() => {
                if (!actionsDisabled) handleEditItem(params.row);
              }}
              color="primary"
              size="small"
              disabled={actionsDisabled}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={() => {
                if (!deleteDisabled) handleDeleteItem(params.row);
              }}
              color="error"
              size="small"
              disabled={deleteDisabled}
              title={
                deleteDisabled && usedCount > 0
                  ? `${usedCount} of ${params.row.quantity || 0} used – cannot delete`
                  : undefined
              }
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
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        {/* Left side: validation error display */}
        <Box sx={{ flex: 1 }}>
          {validationError && (
            <Typography variant="body2" color="error" sx={{ fontWeight: 500 }}>
              {validationError}
            </Typography>
          )}
        </Box>
        {/* Right side: Add Item button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsAddModalOpen(true)}
            disabled={readOnlyAll}
            sx={{
              borderRadius: 0,
              fontWeight: 600,
            }}
          >
            Add Item
          </Button>
        </Box>
      </Box>

      <BaseDataTable<any>
        title=""
        data={mappedProgramItems}
        columns={columns}
        loading={isLoading}
        getRowId={row => row.member_program_item_id}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={5}
        pageSizeOptions={[5, 10, 25]}
        autoHeight={true}
        sortModel={[{ field: 'therapy_name', sort: 'asc' }]}
        enableExport={true}
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
          Add Item to Program
          <IconButton onClick={() => setIsAddModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <AddProgramItemForm
            therapies={therapies}
            onSave={handleAddItem}
            onCancel={() => setIsAddModalOpen(false)}
            mode="create"
            validationError={modalValidationError}
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
          Edit Program Item
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
            <AddProgramItemForm
              therapies={therapies}
              onSave={handleUpdateItem}
              onCancel={() => {
                setIsEditModalOpen(false);
                setEditingItem(null);
              }}
              initialValues={
                {
                  therapy_type_id: editingItem.therapies?.therapy_type_id || 0,
                  therapy_id: editingItem.therapy_id || 0,
                  quantity: editingItem.quantity || 1,
                  days_from_start: editingItem.days_from_start || 0,
                  days_between: editingItem.days_between || 0,
                  instructions: editingItem.instructions || '',
                  // surfaced for edit modal min guards & helper text
                  used_count: (editingItem as any)?.used_count || 0,
                } as any
              }
              mode="edit"
              validationError={modalValidationError}
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
            Are you sure you want to remove this item from the program?
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
