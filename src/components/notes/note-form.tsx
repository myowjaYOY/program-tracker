'use client';

import React from 'react';
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
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leadNoteSchema, LeadNoteFormData } from '@/lib/validations/lead-notes';
import { useCreateLeadNote } from '@/lib/hooks/use-lead-notes';

interface NoteFormProps {
  leadId: number;
  onSuccess: () => void;
}

const NOTE_TYPES = [
  { value: 'Challenge', label: 'Challenge', color: 'error' },
  { value: 'Other', label: 'Other', color: 'default' },
  { value: 'PME', label: 'PME', color: 'primary' },
  { value: 'Win', label: 'Win', color: 'success' },
] as const;

export default function NoteForm({ leadId, onSuccess }: NoteFormProps) {
  const createNote = useCreateLeadNote();

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<LeadNoteFormData>({
    resolver: zodResolver(leadNoteSchema),
    defaultValues: {
      lead_id: leadId,
      note_type: 'Other',
      note: '',
    },
  });

  const onSubmit = async (data: LeadNoteFormData) => {
    try {
      await createNote.mutateAsync(data);
      reset();
      onSuccess();
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
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

      {/* Action Buttons */}
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
          disabled={!isDirty || createNote.isPending}
          startIcon={
            createNote.isPending ? (
              <CircularProgress size={16} />
            ) : undefined
          }
          sx={{
            borderRadius: 0,
          }}
        >
          {createNote.isPending ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}
