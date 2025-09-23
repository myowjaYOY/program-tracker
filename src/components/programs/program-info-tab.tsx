'use client';

import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  Paper,
  Button,
  CircularProgress,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { scheduleKeys } from '@/lib/hooks/use-program-schedule';
import { memberProgramItemTaskKeys } from '@/lib/hooks/use-member-program-item-tasks';
import { todoKeys } from '@/lib/hooks/use-program-todo';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  memberProgramSchema,
  MemberProgramFormData,
} from '@/lib/validations/member-program';
import { MemberPrograms } from '@/types/database.types';
import { useActiveLeads } from '@/lib/hooks/use-leads';
import { useActiveProgramStatus } from '@/lib/hooks/use-program-status';
import FormStatus from '@/components/ui/FormStatus';
import { useMemberProgramFinances } from '@/lib/hooks/use-member-program-finances';
import { useMemberProgramPayments } from '@/lib/hooks/use-member-program-payments';

interface ProgramInfoTabProps {
  program: MemberPrograms;
  onProgramUpdate: (program: MemberPrograms) => void;
  onUnsavedChangesChange: (hasChanges: boolean) => void;
}

export default function ProgramInfoTab({
  program,
  onProgramUpdate,
  onUnsavedChangesChange,
}: ProgramInfoTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState<string>('');
  const [pendingSave, setPendingSave] = useState<MemberProgramFormData | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads = [] } = useActiveLeads();
  const { data: programStatuses = [] } = useActiveProgramStatus();
  const { data: finances } = useMemberProgramFinances(
    program.member_program_id
  );
  const { data: payments = [] } = useMemberProgramPayments(
    program.member_program_id
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    getValues,
  } = useForm<MemberProgramFormData>({
    resolver: zodResolver(memberProgramSchema),
    defaultValues: {
      program_template_name: program.program_template_name || '',
      description: program.description || '',
      lead_id: program.lead_id,
      start_date: program.start_date || '',
      program_status_id: program.program_status_id || null,
      active_flag: program.active_flag,
    },
  });

  // Reset form when program changes
  React.useEffect(() => {
    reset({
      program_template_name: program.program_template_name || '',
      description: program.description || '',
      lead_id: program.lead_id,
      start_date: program.start_date,
      program_status_id: program.program_status_id || null,
      active_flag: program.active_flag,
    });
    // Reset unsaved changes when program changes
    onUnsavedChangesChange(false);
  }, [program.member_program_id, reset, onUnsavedChangesChange]);

  // Track form changes and notify parent
  React.useEffect(() => {
    onUnsavedChangesChange(isDirty);
  }, [isDirty, onUnsavedChangesChange]);

  const performSave = async (data: MemberProgramFormData): Promise<boolean> => {
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const updatedProgram = {
        ...program,
        ...data,
        description: data.description || null,
      };
      await onProgramUpdate(updatedProgram);
      setStatusMsg({ ok: true, message: 'Changes saved successfully' });
      // Reset form values to saved state so isDirty becomes false and Save disables
      reset({
        program_template_name: updatedProgram.program_template_name || '',
        description: updatedProgram.description || '',
        lead_id: updatedProgram.lead_id,
        start_date: updatedProgram.start_date || '',
        program_status_id: updatedProgram.program_status_id || null,
        active_flag: updatedProgram.active_flag,
      });
      onUnsavedChangesChange(false);
      return true;
    } catch (error) {
      const msg = (error as any)?.message || 'Failed to save program';
      setStatusMsg({ ok: false, message: msg });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: MemberProgramFormData) => {
    // Business rules
    const currentStatus = (
      programStatuses.find(s => s.program_status_id === data.program_status_id)
        ?.status_name || ''
    ).toLowerCase();
    const prevStatus = (
      programStatuses.find(
        s => s.program_status_id === program.program_status_id
      )?.status_name || ''
    ).toLowerCase();

    // 0) Block transitions out of Completed/Cancelled
    if (
      (prevStatus === 'completed' || prevStatus === 'cancelled') &&
      currentStatus !== prevStatus
    ) {
      setConfirmText(
        'Programs in Completed or Cancelled status cannot transition to another status. Changes will be discarded.'
      );
      setPendingSave(null);
      setConfirmOpen(true);
      return;
    }

    // 1) If status is Active, Start Date cannot be null
    if (
      currentStatus === 'active' &&
      (!data.start_date || data.start_date === '')
    ) {
      // Surface validation on the field like other forms (MUI TextField error state)
      // We do this by setting a temporary error message in local status and aborting save.
      setStatusMsg({
        ok: false,
        message: 'Start Date is required when status is Active.',
      });
      return;
    }

    // 1b) If status is Active, program must have at least one payment row
    if (currentStatus === 'active' && (!payments || payments.length === 0)) {
      setStatusMsg({
        ok: false,
        message: 'Program must have at least one payment before activating.',
      });
      return;
    }

    // 2) Status transitions: show confirm dialog using our standard pattern
    if (prevStatus === 'active' && currentStatus === 'paused') {
      setConfirmText(
        'All incomplete script items and tasks will be put on hold. Do you want to change status from Active to Paused?'
      );
      setPendingSave(data);
      setConfirmOpen(true);
      return;
    }
    if (prevStatus === 'paused' && currentStatus === 'active') {
      setConfirmText(
        'When reactivating the program, incomplete script items and tasks will be shifted forward by the pause duration. Proceed?'
      );
      setPendingSave(data);
      setConfirmOpen(true);
      return;
    }

    // No confirm needed → save directly
    await performSave(data);
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* Column 1: Program Name, Member, Status, Start Date */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
          >
            <Controller
              name="program_template_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Program Name"
                  fullWidth
                  required
                  error={!!errors.program_template_name}
                  helperText={errors.program_template_name?.message}
                />
              )}
            />

            <Controller
              name="lead_id"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Member"
                  fullWidth
                  {...field}
                  disabled={!!program.member_program_id}
                  value={
                    field.value &&
                    leads.some(lead => lead.lead_id === field.value)
                      ? field.value
                      : ''
                  }
                  onChange={e => {
                    const value = e.target.value;
                    if (value === '') {
                      field.onChange(null);
                    } else {
                      field.onChange(Number(value));
                    }
                  }}
                  error={!!errors.lead_id}
                  helperText={errors.lead_id?.message}
                >
                  <MenuItem value="">
                    <em>Select a member</em>
                  </MenuItem>
                  {leads.map(lead => (
                    <MenuItem key={lead.lead_id} value={lead.lead_id}>
                      {lead.first_name} {lead.last_name} ({lead.email})
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="program_status_id"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Status"
                  fullWidth
                  {...field}
                  value={
                    field.value &&
                    programStatuses.some(
                      status => status.program_status_id === field.value
                    )
                      ? field.value
                      : ''
                  }
                  onChange={e => {
                    const value = e.target.value;
                    if (value === '') {
                      field.onChange(null);
                    } else {
                      field.onChange(Number(value));
                    }
                  }}
                  error={!!errors.program_status_id}
                  helperText={errors.program_status_id?.message}
                >
                  <MenuItem value="">
                    <em>Select a status</em>
                  </MenuItem>
                  {programStatuses.map(status => {
                    const isActive =
                      (status.status_name || '').toLowerCase() === 'active';
                    const disableActive =
                      isActive && (!payments || payments.length === 0);
                    return (
                      <MenuItem
                        key={status.program_status_id}
                        value={status.program_status_id}
                        disabled={disableActive}
                      >
                        {status.status_name}
                      </MenuItem>
                    );
                  })}
                </TextField>
              )}
            />

            <Controller
              name="start_date"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  {...field}
                  value={field.value || ''}
                  error={
                    !!errors.start_date ||
                    (statusMsg &&
                      !statusMsg.ok &&
                      statusMsg.message?.toLowerCase().includes('start date'))
                  }
                  helperText={
                    errors.start_date?.message ||
                    (statusMsg &&
                    !statusMsg.ok &&
                    statusMsg.message?.toLowerCase().includes('start date')
                      ? statusMsg.message
                      : undefined)
                  }
                />
              )}
            />
          </Box>

          {/* Column 2: Active Flag, Description */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
          >
            <Controller
              name="active_flag"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={e => field.onChange(e.target.checked)}
                    />
                  }
                  label="Active Flag"
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description"
                  fullWidth
                  multiline
                  rows={6}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-root': {
                      height: '100%',
                      minHeight: '200px',
                    },
                  }}
                />
              )}
            />
          </Box>
        </Box>

        {/* Save Button and Status */}
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          {/* Right-side status + actions (aligned right like other screens) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormStatus status={statusMsg} onClose={() => setStatusMsg(null)} />
            {/* Generate Schedule Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={async () => {
                try {
                  setIsGenerating(true);
                  // If there are unsaved changes, save first to prevent inconsistencies
                  if (isDirty) {
                    const ok = await performSave(getValues());
                    if (!ok) {
                      // Abort generation if save failed
                      return;
                    }
                  }
                  const currentStatus = (
                    programStatuses.find(
                      s =>
                        s.program_status_id ===
                        (getValues('program_status_id') ??
                          program.program_status_id)
                    )?.status_name || ''
                  ).toLowerCase();
                  const date = getValues('start_date') || program.start_date;
                  if (currentStatus !== 'active' || !date) {
                    setStatusMsg({
                      ok: false,
                      message:
                        'Program must be Active and have a Start Date to generate schedule.',
                    });
                    return;
                  }
                  const res = await fetch(
                    `/api/member-programs/${program.member_program_id}/schedule/generate`,
                    { method: 'POST', credentials: 'include' }
                  );
                  const json = await res.json();
                  if (!res.ok)
                    throw new Error(
                      json.error || 'Failed to generate schedule'
                    );
                  setStatusMsg({
                    ok: true,
                    message: 'Schedule generated successfully',
                  });
                  queryClient.invalidateQueries({
                    queryKey: scheduleKeys.lists(program.member_program_id),
                  });
                  queryClient.invalidateQueries({
                    queryKey: memberProgramItemTaskKeys.byProgram(
                      program.member_program_id
                    ),
                  });
                  queryClient.invalidateQueries({
                    queryKey: todoKeys.lists(program.member_program_id),
                  });
                } catch (e: any) {
                  setStatusMsg({
                    ok: false,
                    message: e?.message || 'Failed to generate schedule',
                  });
                } finally {
                  setIsGenerating(false);
                }
              }}
              disabled={(() => {
                const currentStatus = (
                  programStatuses.find(
                    s =>
                      s.program_status_id ===
                      (getValues('program_status_id') ??
                        program.program_status_id)
                  )?.status_name || ''
                ).toLowerCase();
                const date = getValues('start_date') || program.start_date;
                return isGenerating || currentStatus !== 'active' || !date;
              })()}
              sx={{ borderRadius: 0, fontWeight: 600 }}
            >
              {isGenerating ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} /> Generating...
                </>
              ) : (
                'Generate Schedule'
              )}
            </Button>
            {/* Save Button (far right) */}
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit(onSubmit)}
              disabled={!isDirty || isSaving}
              startIcon={isSaving ? <CircularProgress size={16} /> : null}
              sx={{ borderRadius: 0, fontWeight: 600 }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
        {/* Status Transition Confirmation Dialog */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Confirm Status Change</DialogTitle>
          <DialogContent>{confirmText}</DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                setPendingSave(null);
              }}
              color="primary"
              sx={{ borderRadius: 0 }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmOpen(false);
                if (!pendingSave) {
                  // Blocked transition case: revert UI to previous status
                  setValue(
                    'program_status_id',
                    program.program_status_id || null,
                    { shouldDirty: false }
                  );
                  setPendingSave(null);
                  return;
                }
                try {
                  const nextStatus = (
                    programStatuses.find(
                      s => s.program_status_id === pendingSave.program_status_id
                    )?.status_name || ''
                  ).toLowerCase();
                  const prevStatusName = (
                    programStatuses.find(
                      s => s.program_status_id === program.program_status_id
                    )?.status_name || ''
                  ).toLowerCase();
                  // If Active -> Paused, call pause RPC first
                  if (prevStatusName === 'active' && nextStatus === 'paused') {
                    const res = await fetch(
                      `/api/member-programs/${program.member_program_id}?action=pause`,
                      { method: 'POST', credentials: 'include' }
                    );
                    const json = await res.json();
                    if (!res.ok)
                      throw new Error(json.error || 'Failed to pause program');
                  }
                  await performSave(pendingSave);
                  // Invalidate derived data (Script/Tasks/ToDo) when status changes, especially when paused
                  queryClient.invalidateQueries({
                    queryKey: scheduleKeys.lists(program.member_program_id),
                  });
                  queryClient.invalidateQueries({
                    queryKey: memberProgramItemTaskKeys.byProgram(
                      program.member_program_id
                    ),
                  });
                  queryClient.invalidateQueries({
                    queryKey: todoKeys.lists(program.member_program_id),
                  });
                } catch (e: any) {
                  setStatusMsg({
                    ok: false,
                    message: e?.message || 'Failed to update program status',
                  });
                } finally {
                  setPendingSave(null);
                }
              }}
              color="error"
              variant="contained"
              sx={{ borderRadius: 0 }}
            >
              Proceed
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
