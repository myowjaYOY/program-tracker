'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import { StatusFormData, statusSchema } from '@/lib/validations/status';
import BaseForm from './base-form';
import { useCreateStatus, useUpdateStatus } from '@/lib/hooks/use-status';

interface StatusFormProps {
  initialValues?: Partial<StatusFormData> & { status_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function StatusForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: StatusFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<StatusFormData>({
    resolver: zodResolver(statusSchema) as any,
    defaultValues: {
      status_name: '',
      description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();

  const onSubmit = async (values: StatusFormData) => {
    if (isEdit && initialValues?.status_id) {
      await updateStatus.mutateAsync({
        ...values,
        id: String(initialValues.status_id),
      });
    } else {
      await createStatus.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<StatusFormData>
      onSubmit={onSubmit}
      onCancel={onSuccess ? onSuccess : undefined}
      submitHandler={handleSubmit(onSubmit) as any}
      isSubmitting={
        isSubmitting || createStatus.isPending || updateStatus.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Status Name"
        fullWidth
        required
        {...register('status_name')}
        error={!!errors.status_name}
        helperText={errors.status_name?.message}
      />
      <TextField
        label="Description"
        fullWidth
        multiline
        rows={2}
        {...register('description')}
        error={!!errors.description}
        helperText={errors.description?.message}
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
