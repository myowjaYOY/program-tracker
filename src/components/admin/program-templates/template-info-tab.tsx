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
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  programTemplateSchema,
  ProgramTemplateFormData,
} from '@/lib/validations/program-template';
import { ProgramTemplate } from '@/types/database.types';

interface TemplateInfoTabProps {
  template: ProgramTemplate;
  onTemplateUpdate: (template: ProgramTemplate) => void;
  onUnsavedChangesChange: (hasChanges: boolean) => void;
}

export default function TemplateInfoTab({
  template,
  onTemplateUpdate,
  onUnsavedChangesChange,
}: TemplateInfoTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProgramTemplateFormData>({
    resolver: zodResolver(programTemplateSchema) as any,
    defaultValues: {
      program_template_name: template.program_template_name,
      description: template.description || '',
      active_flag: template.active_flag,
    },
  });

  // Reset form when template changes
  React.useEffect(() => {
    reset({
      program_template_name: template.program_template_name,
      description: template.description || '',
      active_flag: template.active_flag,
    });
    // Reset unsaved changes when template changes
    onUnsavedChangesChange(false);
  }, [template.program_template_id, reset, onUnsavedChangesChange]);

  // Track form changes and notify parent
  React.useEffect(() => {
    onUnsavedChangesChange(isDirty);
  }, [isDirty, onUnsavedChangesChange]);

  const onSubmit = async (data: ProgramTemplateFormData) => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updatedTemplate = { ...template, ...data, description: data.description ?? null };
      await onTemplateUpdate(updatedTemplate);
      setSaveSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Remove auto-save to prevent infinite loops

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* Left side - stacked fields */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              flex: '1 1 255px',
            }}
          >
            <Controller
              name="program_template_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Template Name"
                  fullWidth
                  required
                  error={!!errors.program_template_name}
                  helperText={errors.program_template_name?.message}
                />
              )}
            />

            <TextField
              label="Total Cost"
              value={`$${(template.total_cost || 0).toFixed(2)}`}
              fullWidth
              InputProps={{ readOnly: true }}
              variant="outlined"
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: 'action.disabledBackground',
                  '&:hover': {
                    backgroundColor: 'action.disabledBackground',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'text.secondary',
                },
              }}
            />

            <TextField
              label="Total Charge"
              value={`$${(template.total_charge || 0).toFixed(2)}`}
              fullWidth
              InputProps={{ readOnly: true }}
              variant="outlined"
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: 'action.disabledBackground',
                  '&:hover': {
                    backgroundColor: 'action.disabledBackground',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'text.secondary',
                },
              }}
            />

            <TextField
              label="Margin Percentage"
              value={`${(template.margin_percentage || 0).toFixed(1)}%`}
              fullWidth
              InputProps={{ readOnly: true }}
              variant="outlined"
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: 'action.disabledBackground',
                  '&:hover': {
                    backgroundColor: 'action.disabledBackground',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'text.secondary',
                },
              }}
            />
          </Box>

          {/* Right side - Active switch and Description */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              flex: '1 1 255px',
            }}
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
                  label="Active"
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
                  rows={9}
                  error={!!errors.description}
                  helperText={errors.description?.message}
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
            gap: 2,
          }}
        >
          {/* Success Message */}
          {saveSuccess && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: 'success.main',
                fontSize: '0.875rem',
              }}
            >
              ✓ Changes saved successfully!
            </Box>
          )}

          {/* Save Button */}
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(onSubmit) as any}
            disabled={!isDirty || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : null}
            sx={{
              borderRadius: 0,
              fontWeight: 600,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
