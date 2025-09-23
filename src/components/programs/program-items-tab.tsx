'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
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
  const [isEditing, setIsEditing] = useState(false);
  type StagedChange =
    | {
        type: 'add';
        therapy_id: number;
        quantity: number;
        days_from_start?: number;
        days_between?: number;
        instructions?: string | undefined;
      }
    | { type: 'remove'; itemId: number }
    | {
        type: 'update';
        itemId: number;
        therapy_id?: number;
        quantity?: number;
        days_from_start?: number;
        days_between?: number;
        instructions?: string | undefined;
      };
  interface PreviewState {
    ok: boolean;
    locked?: { price: number; margin: number };
    projected?: { price: number; margin: number; charge: number; cost: number };
    deltas?: { price: number; margin: number };
    loading?: boolean;
    error?: string | null;
  }
  const [stagedChanges, setStagedChanges] = useState<StagedChange[]>([]);
  const [preview, setPreview] = useState<PreviewState>({
    ok: true,
    loading: false,
    error: null,
  });

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
  const [inline, setInline] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  // Warn parent (Programs page) if there are unsaved staged edits (edit mode)
  React.useEffect(() => {
    onUnsavedChangesChange?.(isEditing && stagedChanges.length > 0);
  }, [isEditing, stagedChanges.length, onUnsavedChangesChange]);

  // Browser unload guard while editing
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isEditing && stagedChanges.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    if (isEditing && stagedChanges.length > 0) {
      window.addEventListener('beforeunload', handler);
    }
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditing, stagedChanges.length]);
  const { data: freshProgram } = useMemberProgram(program.member_program_id);
  const { data: statuses = [] } = useProgramStatus();
  const { data: payments = [] } = useMemberProgramPayments(
    program.member_program_id
  );
  const lock = useFinancialsLock(freshProgram || program, payments as any);
  const isLocked = lock.locked;
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
  const [applying, setApplying] = useState(false);

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
        const res = await fetch(
          `/api/member-programs/${program.member_program_id}/items/preview`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              changes: stagedChanges,
              tolerance: { priceCents: 1, marginPct: 0.1 },
            }),
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Preview failed');
        setPreview({
          ok: !!json.ok,
          locked: json.locked,
          projected: json.projected,
          deltas: json.deltas,
          loading: false,
          error: null,
        });
      } catch (e: any) {
        setPreview({
          ok: false,
          loading: false,
          error: e?.message || 'Preview failed',
        });
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
    total_charge: (item.item_charge || 0) * (item.quantity || 1),
  })) as ProgramItemWithTherapy[];

  // Apply stagedChanges locally to what the grid displays while in edit mode
  const visibleItems = React.useMemo(() => {
    if (!isEditing || stagedChanges.length === 0) return mappedProgramItems;

    // Start from a map of current rows for easy mutation by id
    const rowsById = new Map<number, any>();
    mappedProgramItems.forEach(row =>
      rowsById.set(row.member_program_item_id as number, { ...row })
    );

    let tempId = -1; // negative ids for staged additions

    for (const ch of stagedChanges) {
      if (ch.type === 'remove') {
        rowsById.delete(ch.itemId);
      } else if (ch.type === 'update') {
        const existing = rowsById.get(ch.itemId);
        if (!existing) continue;
        const next = { ...existing };
        if (typeof ch.quantity === 'number') next.quantity = ch.quantity;
        if (typeof ch.days_from_start === 'number')
          next.days_from_start = ch.days_from_start;
        if (typeof ch.days_between === 'number')
          next.days_between = ch.days_between;
        if (typeof ch.instructions === 'string')
          next.instructions = ch.instructions || '';
        if (typeof ch.therapy_id === 'number') {
          const t = therapies.find(t => t.therapy_id === ch.therapy_id);
          if (t) {
            next.therapy_id = t.therapy_id;
            next.item_cost = Number(t.cost || 0);
            next.item_charge = Number(t.charge || 0);
            next.therapies = {
              therapy_name: t.therapy_name,
              cost: Number(t.cost || 0),
              charge: Number(t.charge || 0),
              active_flag: !!t.active_flag,
              therapy_type_id: t.therapy_type_id || 0,
              therapytype: { therapy_type_name: t.therapy_type_name || 'N/A' },
              buckets: { bucket_name: t.bucket_name || 'N/A' },
            };
            next.therapy_type_name = t.therapy_type_name || 'N/A';
            next.therapy_name = t.therapy_name;
            next.bucket_name = t.bucket_name || 'N/A';
            next.therapy_cost = Number(t.cost || 0);
            next.therapy_charge = Number(t.charge || 0);
          }
        }
        next.total_cost =
          Number(next.item_cost || 0) * Number(next.quantity || 1);
        next.total_charge =
          Number(next.item_charge || 0) * Number(next.quantity || 1);
        rowsById.set(ch.itemId, next);
      } else if (ch.type === 'add') {
        const t = therapies.find(t => t.therapy_id === ch.therapy_id);
        if (!t) continue;
        const quantity = Math.max(0, Number(ch.quantity || 0));
        const newRow: any = {
          id: tempId,
          member_program_item_id: tempId,
          member_program_id: program.member_program_id,
          therapy_id: t.therapy_id,
          quantity,
          item_cost: Number(t.cost || 0),
          item_charge: Number(t.charge || 0),
          days_from_start: ch.days_from_start ?? 0,
          days_between: ch.days_between ?? 0,
          instructions: ch.instructions || '',
          active_flag: true,
          created_at: null,
          created_by: null,
          updated_at: null,
          updated_by: null,
          therapies: {
            therapy_name: t.therapy_name,
            cost: Number(t.cost || 0),
            charge: Number(t.charge || 0),
            active_flag: !!t.active_flag,
            therapy_type_id: t.therapy_type_id || 0,
            therapytype: { therapy_type_name: t.therapy_type_name || 'N/A' },
            buckets: { bucket_name: t.bucket_name || 'N/A' },
          },
          therapy_type_name: t.therapy_type_name || 'N/A',
          therapy_name: t.therapy_name,
          bucket_name: t.bucket_name || 'N/A',
          therapy_cost: Number(t.cost || 0),
          therapy_charge: Number(t.charge || 0),
          total_cost: Number(t.cost || 0) * quantity,
          total_charge: Number(t.charge || 0) * quantity,
        };
        rowsById.set(tempId, newRow);
        tempId -= 1;
      }
    }

    return Array.from(rowsById.values());
  }, [
    isEditing,
    stagedChanges,
    mappedProgramItems,
    therapies,
    program.member_program_id,
  ]);

  const handleAddItem = async (formData: MemberProgramItemFormData) => {
    if (isEditing) {
      const ch: StagedChange = {
        type: 'add',
        therapy_id: formData.therapy_id,
        quantity: formData.quantity,
        days_from_start: formData.days_from_start,
        days_between: formData.days_between,
        instructions: formData.instructions,
      };
      setStagedChanges(prev => [...prev, ch]);
      setIsAddModalOpen(false);
      return;
    }
    try {
      await createItem.mutateAsync({
        member_program_id: program.member_program_id,
        therapy_id: formData.therapy_id,
        quantity: formData.quantity,
        days_from_start: formData.days_from_start,
        days_between: formData.days_between,
        instructions: formData.instructions ?? null,
      });
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding program item:', error);
    }
  };

  const handleDeleteItem = async (item: MemberProgramItems) => {
    if (
      window.confirm(
        'Are you sure you want to remove this item from the program?'
      )
    ) {
      if (isEditing) {
        const ch: StagedChange = {
          type: 'remove',
          itemId: item.member_program_item_id,
        };
        setStagedChanges(prev => [...prev, ch]);
        return;
      }
      try {
        await deleteItem.mutateAsync({
          programId: program.member_program_id,
          itemId: item.member_program_item_id,
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

  const handleUpdateItem = async (formData: MemberProgramItemFormData) => {
    if (!editingItem) return;

    if (isEditing) {
      const ch: StagedChange = {
        type: 'update',
        itemId: editingItem.member_program_item_id,
        therapy_id: formData.therapy_id,
        quantity: formData.quantity,
        days_from_start: formData.days_from_start,
        days_between: formData.days_between,
        instructions: formData.instructions,
      };
      setStagedChanges(prev => [...prev, ch]);
      setIsEditModalOpen(false);
      setEditingItem(null);
      return;
    }
    try {
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
    } catch (error) {
      console.error('Error updating program item:', error);
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
      headerName: 'Days After Start',
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
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: params => {
        if (!params?.row) return null;
        const actionsDisabled = (isLocked && !isEditing) || readOnlyAll;
        const usedCount = Number((params as any).row?.used_count || 0);
        const deleteDisabled = actionsDisabled || (isEditing && usedCount > 0);
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
        {/* Left side: tokens stacked above helper line with actions */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 1,
            flex: 1,
          }}
        >
          {isEditing && (
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  flexWrap: 'wrap',
                }}
              >
                <Chip
                  size="small"
                  label={`Changes: ${stagedChanges.length}`}
                  color={stagedChanges.length > 0 ? 'primary' : 'default'}
                />
                {preview.loading ? (
                  <Chip size="small" label="Previewing..." />
                ) : preview.error ? (
                  <Chip size="small" label={preview.error} color="error" />
                ) : preview.locked ? (
                  <>
                    <Chip
                      size="small"
                      label={`Locked Price $${preview.locked.price?.toFixed(2)}`}
                    />
                    <Chip
                      size="small"
                      label={`Locked Margin ${preview.locked.margin?.toFixed(1)}%`}
                    />
                    {preview.projected && (
                      <>
                        <Chip
                          size="small"
                          label={`Projected Price $${preview.projected.price?.toFixed(2)}`}
                          color={preview.ok ? 'success' : 'error'}
                        />
                        <Chip
                          size="small"
                          label={`Projected Margin ${preview.projected.margin?.toFixed(1)}%`}
                          color={preview.ok ? 'success' : 'error'}
                        />
                      </>
                    )}
                  </>
                ) : null}
              </Box>
              {/* helper text row with actions aligned to the end */}
              <Box
                sx={{
                  mt: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  flexWrap: 'wrap',
                }}
              >
                <Typography variant="caption">
                  Apply is enabled when projected Program Price and Margin match
                  the locked values (within tolerance).
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={
                    applying ||
                    stagedChanges.length === 0 ||
                    !preview.ok ||
                    !!preview.loading
                  }
                  onClick={async () => {
                    setApplying(true);
                    try {
                      const res = await fetch(
                        `/api/member-programs/${program.member_program_id}/items/batch-apply`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            changes: stagedChanges,
                            expectedLocked: {
                              price:
                                finances?.final_total_price ??
                                preview.locked?.price ??
                                0,
                              margin:
                                finances?.margin ?? preview.locked?.margin ?? 0,
                            },
                            tolerance: { priceCents: 1, marginPct: 0.1 },
                          }),
                        }
                      );
                      const json = await res.json();
                      if (!res.ok)
                        throw new Error(json.error || 'Apply failed');
                      await refetchProgram();
                      resetEditing();
                      setInline({
                        ok: true,
                        message: 'Changes applied successfully',
                      });
                      queryClient.invalidateQueries({
                        queryKey: memberProgramItemKeys.byProgram(
                          program.member_program_id
                        ),
                      });
                      // Also regenerate schedule so Script reflects item changes
                      try {
                        await fetch(
                          `/api/member-programs/${program.member_program_id}/schedule/generate`,
                          {
                            method: 'POST',
                            credentials: 'include',
                          }
                        );
                      } catch {}
                      // Refresh Tasks and Script/ToDo tabs derived data
                      queryClient.invalidateQueries({
                        queryKey: memberProgramItemTaskKeys.byProgram(
                          program.member_program_id
                        ),
                      });
                      queryClient.invalidateQueries({
                        queryKey: todoKeys.lists(program.member_program_id),
                      });
                    } catch (e: any) {
                      setInline({
                        ok: false,
                        message: e?.message || 'Failed to apply changes',
                      });
                    } finally {
                      setApplying(false);
                    }
                  }}
                  startIcon={applying ? <CircularProgress size={16} /> : null}
                  sx={{ borderRadius: 0, fontWeight: 600 }}
                >
                  {applying ? 'Saving...' : 'Apply Changes'}
                </Button>
                <Button
                  variant="text"
                  onClick={resetEditing}
                  disabled={applying}
                  sx={{ borderRadius: 0 }}
                >
                  Cancel
                </Button>
              </Box>
            </>
          )}
        </Box>
        {/* Right side controls: keep positions stable (Edit Mode + Add Item) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Edit Mode button visible only when locked; hidden when unlocked */}
          {isLocked && !readOnlyAll && (
            <Button
              variant="outlined"
              onClick={() => {
                if (isEditing) {
                  resetEditing();
                } else {
                  setIsEditing(true);
                }
              }}
              sx={{ borderRadius: 0, fontWeight: 600 }}
            >
              {isEditing ? 'Exit Edit Mode' : 'Enter Edit Mode'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsAddModalOpen(true)}
            disabled={(isLocked && !isEditing) || readOnlyAll}
            sx={{
              borderRadius: 0,
              fontWeight: 600,
            }}
          >
            Add Item
          </Button>
        </Box>
        {isEditing && (
          <FormStatus status={inline} onClose={() => setInline(null)} />
        )}
      </Box>

      <BaseDataTable<any>
        title=""
        data={visibleItems}
        columns={columns}
        loading={isLoading}
        getRowId={row => row.member_program_item_id}
        showCreateButton={false}
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
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
