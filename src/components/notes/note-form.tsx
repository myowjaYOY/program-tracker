'use client';

import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  CircularProgress,
  FormControlLabel,
  Switch,
  Chip,
  OutlinedInput,
  Collapse,
} from '@mui/material';
import { NotificationsActive as AlertIcon } from '@mui/icons-material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leadNoteSchema, LeadNoteFormData } from '@/lib/validations/lead-notes';
import { useCreateLeadNote } from '@/lib/hooks/use-lead-notes';
import { useCreateNotification } from '@/lib/hooks/use-notifications';
import { useActiveProgramRoles } from '@/lib/hooks/use-program-roles';

interface NoteFormProps {
  leadId: number;
  onSuccess: () => void;
  /** Hide buttons when rendered in modal (buttons provided by DialogActions) */
  hideButtons?: boolean;
  /** Form ID for external submit button linking */
  formId?: string;
}

const NOTE_TYPES = [
  { value: 'Challenge', label: 'Challenge', color: 'error' },
  { value: 'Follow-Up', label: 'Follow-Up', color: 'info' },
  { value: 'Other', label: 'Other', color: 'default' },
  { value: 'PME', label: 'PME', color: 'primary' },
  { value: 'Win', label: 'Win', color: 'success' },
] as const;

export default function NoteForm({ leadId, onSuccess, hideButtons = false, formId }: NoteFormProps) {
  const createNote = useCreateLeadNote();
  const createNotification = useCreateNotification();
  const { data: programRoles = [] } = useActiveProgramRoles();

  // Alert state
  const [createAlert, setCreateAlert] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertPriority, setAlertPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [alertTargetRoles, setAlertTargetRoles] = useState<number[]>([]);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<LeadNoteFormData>({
    resolver: zodResolver(leadNoteSchema),
    defaultValues: {
      lead_id: leadId,
      note_type: 'Other',
      note: '',
    },
  });

  const noteContent = watch('note');

  const onSubmit = async (data: LeadNoteFormData) => {
    try {
      // Create the note first
      const newNote = await createNote.mutateAsync(data);
      
      // If alert is enabled, create notification linked to this note
      if (createAlert && alertTargetRoles.length > 0) {
        await createNotification.mutateAsync({
          lead_id: leadId,
          title: alertTitle || `New ${data.note_type} Note`,
          message: data.note,
          priority: alertPriority,
          target_role_ids: alertTargetRoles,
          source_note_id: newNote.note_id,
        });
      }
      
      // Reset form and alert state
      reset();
      setCreateAlert(false);
      setAlertTitle('');
      setAlertPriority('normal');
      setAlertTargetRoles([]);
      onSuccess();
    } catch (error) {
      // Error is handled by the mutation hooks
    }
  };

  return (
    <Box
      component="form"
      id={formId}
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 2,
        ...(hideButtons ? {} : { borderBottom: 1, borderColor: 'divider' }),
      }}
    >

      {/* Note Type */}
      <Controller
        name="note_type"
        control={control}
        render={({ field }) => (
          <FormControl fullWidth error={!!errors.note_type}>
            <InputLabel>Note Type</InputLabel>
            <Select
              {...field}
              label="Note Type"
              value={field.value || ''}
            >
              {NOTE_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
            {errors.note_type && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                {errors.note_type.message}
              </Typography>
            )}
          </FormControl>
        )}
      />

      {/* Note Content */}
      <Controller
        name="note"
        control={control}
        render={({ field }) => (
      <TextField
        {...field}
        label="Note Content"
        fullWidth
        multiline
        rows={3}
        placeholder="Enter your note here..."
        error={!!errors.note}
        helperText={errors.note?.message}
        sx={{
          '& .MuiInputBase-root': {
            minHeight: '90px',
          },
        }}
      />
        )}
      />

      {/* Create Alert Toggle */}
      <FormControlLabel
        sx={{ mb: createAlert ? 0 : -1 }}
        control={
          <Switch
            checked={createAlert}
            onChange={(e) => setCreateAlert(e.target.checked)}
            color="warning"
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertIcon color={createAlert ? 'warning' : 'disabled'} fontSize="small" />
            <Typography variant="body2">Create Alert from this note</Typography>
          </Box>
        }
      />

      {/* Alert Options - shown when createAlert is true */}
      <Collapse in={createAlert}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 2, borderLeft: 3, borderColor: 'warning.main' }}>
          {/* Alert Title and Priority on same row */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Alert Title"
              value={alertTitle}
              onChange={(e) => setAlertTitle(e.target.value)}
              size="small"
              placeholder={`New ${watch('note_type') || 'Other'} Note`}
              sx={{ flex: 2 }}
            />
            <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={alertPriority}
                onChange={(e) => setAlertPriority(e.target.value as 'normal' | 'high' | 'urgent')}
                label="Priority"
              >
                <MenuItem value="normal">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'info.main' }} />
                    Normal
                  </Box>
                </MenuItem>
                <MenuItem value="high">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'warning.main' }} />
                    High
                  </Box>
                </MenuItem>
                <MenuItem value="urgent">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main' }} />
                    Urgent
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Target Roles */}
          <FormControl fullWidth size="small">
            <InputLabel>Notify Roles</InputLabel>
            <Select
              multiple
              value={alertTargetRoles}
              onChange={(e) => setAlertTargetRoles(e.target.value as number[])}
              input={<OutlinedInput label="Notify Roles" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((roleId) => {
                    const role = programRoles.find(r => r.program_role_id === roleId);
                    return role ? (
                      <Chip
                        key={roleId}
                        label={role.role_name}
                        size="small"
                        sx={{ bgcolor: role.display_color, color: 'white' }}
                      />
                    ) : null;
                  })}
                </Box>
              )}
            >
              {programRoles.map((role) => (
                <MenuItem key={role.program_role_id} value={role.program_role_id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: role.display_color }} />
                    {role.role_name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Collapse>

      {/* Action Buttons - only show if not hidden */}
      {!hideButtons && (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
            pt: 2,
          }}
        >
          <Button
            type="submit"
            variant="contained"
            disabled={!isDirty || createNote.isPending || createNotification.isPending || (createAlert && alertTargetRoles.length === 0)}
            startIcon={
              (createNote.isPending || createNotification.isPending) ? (
                <CircularProgress size={16} />
              ) : undefined
            }
            sx={{
              borderRadius: 0,
            }}
          >
            {(createNote.isPending || createNotification.isPending) ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      )}
    </Box>
  );
}

// Export for external use (e.g., checking form state)
export { NOTE_TYPES };
