'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';

import {
  ProgramRolesFormData,
  programRolesSchema,
} from '@/lib/validations/program-roles';
import BaseForm from './base-form';
import {
  useCreateProgramRole,
  useUpdateProgramRole,
} from '@/lib/hooks/use-program-roles';

interface ProgramRoleFormProps {
  initialValues?: Partial<ProgramRolesFormData> & { program_role_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function ProgramRoleForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: ProgramRoleFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ProgramRolesFormData>({
    resolver: zodResolver(programRolesSchema),
    defaultValues: {
      role_name: '',
      description: '',
      display_color: '#808080',
      display_order: 0,
      active_flag: true,
      ...initialValues,
    },
  });

  const createProgramRole = useCreateProgramRole();
  const updateProgramRole = useUpdateProgramRole();

  const onSubmit = async (values: ProgramRolesFormData) => {
    if (isEdit && initialValues?.program_role_id) {
      await updateProgramRole.mutateAsync({
        ...values,
        id: String(initialValues.program_role_id),
      });
    } else {
      await createProgramRole.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<ProgramRolesFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createProgramRole.isPending || updateProgramRole.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Role Name"
        fullWidth
        required
        {...register('role_name')}
        error={!!errors.role_name}
        helperText={errors.role_name?.message || 'e.g., Coordinator, Admin, Member'}
      />
      <TextField
        label="Description"
        fullWidth
        multiline
        rows={3}
        {...register('description')}
        error={!!errors.description}
        helperText={
          errors.description?.message ||
          'Brief description of role responsibilities'
        }
      />
      <TextField
        label="Display Color"
        fullWidth
        required
        {...register('display_color')}
        error={!!errors.display_color}
        helperText={
          errors.display_color?.message || 'Hex color for UI display (e.g., #1976d2)'
        }
        placeholder="#1976d2"
      />
      <TextField
        label="Display Order"
        fullWidth
        required
        type="number"
        {...register('display_order', { valueAsNumber: true })}
        error={!!errors.display_order}
        helperText={
          errors.display_order?.message || 'Sort order in dropdowns (lower = first)'
        }
      />

      <FormControlLabel
        control={
          <Switch
            color="primary"
            checked={!!watch('active_flag')}
            onChange={(_, checked) => setValue('active_flag', checked)}
          />
        }
        label="Active"
      />
    </BaseForm>
  );
}


