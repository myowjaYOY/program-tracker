'use client';

import React from 'react';
import {
  TextField,
  MenuItem,
  Grid,
  FormControlLabel,
  Switch,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  FormHelperText,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  programTemplateRashaSchema,
  ProgramTemplateRashaFormData,
} from '@/lib/validations/program-template-rasha';
import { RashaList } from '@/types/database.types';
import { BaseForm } from '@/components/forms/base-form';

interface AddTemplateRashaFormProps {
  rashaItems: RashaList[];
  onSave: (data: ProgramTemplateRashaFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<ProgramTemplateRashaFormData>;
  mode?: 'create' | 'edit';
}

export default function AddTemplateRashaForm({
  rashaItems,
  onSave,
  onCancel,
  initialValues,
  mode = 'create',
}: AddTemplateRashaFormProps) {
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProgramTemplateRashaFormData>({
    resolver: zodResolver(programTemplateRashaSchema) as any,
    defaultValues: {
      program_template_id: initialValues?.program_template_id || 0,
      rasha_list_id: initialValues?.rasha_list_id || 0,
      group_name: initialValues?.group_name || '',
      type: initialValues?.type || 'individual',
      order_number: initialValues?.order_number ?? 0,
      active_flag: initialValues?.active_flag ?? true,
    },
  });

  const selectedRashaId = watch('rasha_list_id');
  const selectedType = watch('type');

  // Reset form when initialValues change (for edit mode)
  React.useEffect(() => {
    if (initialValues && mode === 'edit') {
      reset({
        program_template_id: initialValues.program_template_id || 0,
        rasha_list_id: initialValues.rasha_list_id || 0,
        group_name: initialValues.group_name || '',
        type: initialValues.type || 'individual',
        order_number: initialValues.order_number ?? 0,
        active_flag: initialValues.active_flag ?? true,
      });
    }
  }, [initialValues, mode, reset]);

  // Find selected RASHA item for display
  const selectedRashaItem = rashaItems.find(
    r => r.rasha_list_id === selectedRashaId
  );

  const onSubmit = (data: ProgramTemplateRashaFormData) => {
    onSave(data);
  };

  return (
    <BaseForm
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      submitText={
        isSubmitting
          ? mode === 'edit'
            ? 'Updating...'
            : 'Adding...'
          : mode === 'edit'
            ? 'Update'
            : 'Add'
      }
      submitHandler={handleSubmit(onSubmit) as any}
      buttonContainerSx={{ width: 500, justifyContent: 'flex-end' }}
    >
      <Grid size={{ xs: 12 }}>
        <Controller
          name="rasha_list_id"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="RASHA Item"
              fullWidth
              required
              error={!!errors.rasha_list_id}
              helperText={
                errors.rasha_list_id?.message ||
                (selectedRashaItem
                  ? `Length: ${selectedRashaItem.length}`
                  : '')
              }
              sx={{ minWidth: 500, maxWidth: 500 }}
              disabled={mode === 'edit'}
              onChange={e => field.onChange(Number(e.target.value))}
            >
              <MenuItem value={0}>Select a RASHA item...</MenuItem>
              {rashaItems
                .filter(r => r.active_flag)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(rashaItem => (
                  <MenuItem
                    key={rashaItem.rasha_list_id}
                    value={rashaItem.rasha_list_id}
                  >
                    {rashaItem.name} (Length: {rashaItem.length})
                  </MenuItem>
                ))}
            </TextField>
          )}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <FormControl component="fieldset" error={!!errors.type}>
              <FormLabel component="legend">Type *</FormLabel>
              <RadioGroup
                row
                {...field}
                value={field.value || 'individual'}
                onChange={e => field.onChange(e.target.value)}
              >
                <FormControlLabel
                  value="individual"
                  control={<Radio />}
                  label="Individual"
                />
                <FormControlLabel
                  value="group"
                  control={<Radio />}
                  label="Group"
                />
              </RadioGroup>
              {errors.type && (
                <FormHelperText>{errors.type.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Controller
          name="group_name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Group Name"
              fullWidth
              error={!!errors.group_name}
              helperText={
                errors.group_name?.message ||
                'Optional - Used to identify groups or organizational units'
              }
              sx={{ minWidth: 500, maxWidth: 500 }}
              value={field.value || ''}
            />
          )}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Controller
          name="order_number"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Order"
              type="number"
              fullWidth
              required
              inputProps={{ min: 0, step: 1 }}
              error={!!errors.order_number}
              helperText={
                errors.order_number?.message ||
                'Display order in the list (0 = first)'
              }
              sx={{ minWidth: 500, maxWidth: 500 }}
              onChange={e => field.onChange(Number(e.target.value))}
            />
          )}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Controller
          name="active_flag"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  color="primary"
                />
              }
              label="Active"
            />
          )}
        />
      </Grid>
    </BaseForm>
  );
}

