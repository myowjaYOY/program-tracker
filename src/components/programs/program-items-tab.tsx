'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import BaseDataTable, { commonColumns } from '@/components/tables/base-data-table';
import { MemberPrograms, MemberProgramItems } from '@/types/database.types';
import { useMemberProgramItems, useCreateMemberProgramItem, useUpdateMemberProgramItem, useDeleteMemberProgramItem } from '@/lib/hooks/use-member-program-items';
import { useTherapies } from '@/lib/hooks/use-therapies';
import { useMemberProgram } from '@/lib/hooks/use-member-programs';
import { useMemberProgramFinances } from '@/lib/hooks/use-member-program-finances';
import AddProgramItemForm from './add-program-item-form';

interface ProgramItemsTabProps {
  program: MemberPrograms;
  onProgramUpdate: (program: MemberPrograms) => void;
}

// Extended interface for items with joined therapy data
interface ProgramItemWithTherapy extends MemberProgramItems {
  id: number;
  therapies: {
    therapy_name: string;
    cost: number;
    charge: number;
    active_flag: boolean;
    therapytype: {
      therapy_type_name: string;
    };
    buckets: {
      bucket_name: string;
    };
  };
}

export default function ProgramItemsTab({ program, onProgramUpdate }: ProgramItemsTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MemberProgramItems | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [stagedChanges, setStagedChanges] = useState<any[]>([]);
  const [preview, setPreview] = useState<{ ok: boolean; locked?: { price: number; margin: number }; projected?: { price: number; margin: number; charge: number; cost: number }; deltas?: { price: number; margin: number }; loading?: boolean; error?: string | null }>({ ok: true, loading: false, error: null });
  
  const { data: programItems = [], isLoading, error } = useMemberProgramItems(program.member_program_id);
  const { data: therapies = [] } = useTherapies();
  const { data: updatedProgram, refetch: refetchProgram } = useMemberProgram(program.member_program_id);
  const createItem = useCreateMemberProgramItem();
  const updateItem = useUpdateMemberProgramItem();
  const deleteItem = useDeleteMemberProgramItem();
  const { data: finances } = useMemberProgramFinances(program.member_program_id);

  // Update parent component when program data changes
  React.useEffect(() => {
    if (updatedProgram) {
      onProgramUpdate(updatedProgram);
    }
  }, [updatedProgram, onProgramUpdate]);

  // Auto-preview when editing
  React.useEffect(() => {
    if (!isEditing) return;
    const run = async () => {
      setPreview(p => ({ ...p, loading: true, error: null }));
      try {
        const res = await fetch(`/api/member-programs/${program.member_program_id}/items/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ changes: stagedChanges, tolerance: { priceCents: 1, marginPct: 0.1 } })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Preview failed');
        setPreview({ ok: !!json.ok, locked: json.locked, projected: json.projected, deltas: json.deltas, loading: false, error: null });
      } catch (e: any) {
        setPreview({ ok: false, loading: false, error: e?.message || 'Preview failed' });
      }
    };
    run();
  }, [isEditing, stagedChanges, program.member_program_id]);

  const resetEditing = () => {
    setIsEditing(false);
    setStagedChanges([]);
    setPreview({ ok: true, loading: false, error: null });
    setEditingItem(null);
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
  };

  

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
    total_cost: (item.item_cost || 0) * (item.quantity || 1),
    total_charge: (item.item_charge || 0) * (item.quantity || 1)
  })) as ProgramItemWithTherapy[];

  const handleAddItem = async (formData: {
    therapy_type_id: number;
    therapy_id: number;
    quantity: number;
    days_from_start: number;
    days_between: number;
    instructions?: string;
  }) => {
    try {
      await createItem.mutateAsync({
        member_program_id: program.member_program_id,
        ...formData
      });
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding program item:', error);
    }
  };

  const handleDeleteItem = async (item: MemberProgramItems) => {
    if (window.confirm('Are you sure you want to remove this item from the program?')) {
      try {
        await deleteItem.mutateAsync({
          programId: program.member_program_id,
          itemId: item.member_program_item_id
        });
      } catch (error) {
        console.error('Error deleting program item:', error);
      }
    } else {
      
    }
  };

  const handleEditItem = (item: MemberProgramItems) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async (formData: {
    therapy_type_id: number;
    therapy_id: number;
    quantity: number;
    days_from_start: number;
    days_between: number;
    instructions?: string;
  }) => {
    if (!editingItem) return;
    
    try {
      await updateItem.mutateAsync({
        programId: program.member_program_id,
        itemId: editingItem.member_program_item_id,
        data: formData
      });
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating program item:', error);
    }
  };

  const columns = [
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
      width: 100,
      type: 'number',
    },
    {
      field: 'days_from_start',
      headerName: 'Days Before Start',
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {isEditing && (
            <>
              <Chip label={`Changes: ${stagedChanges.length}`} color={stagedChanges.length > 0 ? 'primary' : 'default'} />
              {preview.loading ? (
                <Chip label="Previewing..." />
              ) : preview.error ? (
                <Chip label={preview.error} color="error" />
              ) : preview.locked ? (
                <>
                  <Chip label={`Locked Price $${preview.locked.price?.toFixed(2)}`} />
                  <Chip label={`Locked Margin ${preview.locked.margin?.toFixed(1)}%`} />
                  {preview.projected && (
                    <>
                      <Chip label={`Projected Price $${preview.projected.price?.toFixed(2)}`} color={preview.ok ? 'success' : 'error'} />
                      <Chip label={`Projected Margin ${preview.projected.margin?.toFixed(1)}%`} color={preview.ok ? 'success' : 'error'} />
                    </>
                  )}
                </>
              ) : null}
            </>
          )}
        </Box>
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
        <Button
          variant="outlined"
          onClick={() => { if (isEditing) { resetEditing(); } else { setIsEditing(true); } }}
          sx={{ ml: 2, borderRadius: 0, fontWeight: 600 }}
        >{isEditing ? 'Exit Edit Mode' : 'Enter Edit Mode'}</Button>
        {isEditing && (
          <>
            <Button
              variant="contained"
              color="success"
              disabled={stagedChanges.length === 0 || !preview.ok || preview.loading}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/member-programs/${program.member_program_id}/items/batch-apply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ changes: stagedChanges, expectedLocked: { price: finances?.final_total_price ?? preview.locked?.price ?? 0, margin: finances?.margin ?? preview.locked?.margin ?? 0 }, tolerance: { priceCents: 1, marginPct: 0.1 } })
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error || 'Apply failed');
                  await refetchProgram();
                  resetEditing();
                } catch (e: any) {
                  alert(e?.message || 'Failed to apply changes');
                }
              }}
              sx={{ ml: 2, borderRadius: 0, fontWeight: 600 }}
            >Apply Changes</Button>
            <Button variant="text" onClick={resetEditing} sx={{ ml: 1 }}>Cancel</Button>
          </>
        )}
      </Box>

      <BaseDataTable<any>
        title=""
        data={mappedProgramItems}
        columns={columns}
        loading={isLoading}
        getRowId={(row) => row.member_program_item_id}
        showCreateButton={false}
        showEditButton={false}
        showDeleteButton={false}
        showTitle={false}
        showActionsColumn={false}
        pageSize={5}
        pageSizeOptions={[5, 10, 25]}
        autoHeight={true}
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
            maxWidth: '90vw'
          }
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
            maxWidth: '90vw'
          }
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
              initialValues={{
                therapy_type_id: editingItem.therapies?.therapy_type_id || 0,
                therapy_id: editingItem.therapy_id || 0,
                quantity: editingItem.quantity || 1,
                days_from_start: editingItem.days_from_start || 0,
                days_between: editingItem.days_between || 0,
                instructions: editingItem.instructions || ''
              }}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}