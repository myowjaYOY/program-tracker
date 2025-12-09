'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import { PillarFormData, pillarSchema } from '@/lib/validations/pillar';
import BaseForm from './base-form';
import { useCreatePillar, useUpdatePillar } from '@/lib/hooks/use-pillars';

interface PillarFormProps {
  initialValues?: Partial<PillarFormData> & { pillar_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function PillarForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: PillarFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<PillarFormData>({
    resolver: zodResolver(pillarSchema) as any,
    defaultValues: {
      pillar_name: '',
      description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const createPillar = useCreatePillar();
  const updatePillar = useUpdatePillar();

  const onSubmit = async (values: PillarFormData) => {
    if (isEdit && initialValues?.pillar_id) {
      await updatePillar.mutateAsync({
        ...values,
        id: String(initialValues.pillar_id),
      });
    } else {
      await createPillar.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<PillarFormData>
      onSubmit={onSubmit}
      onCancel={onSuccess ? onSuccess : undefined}
      submitHandler={handleSubmit(onSubmit) as any}
      isSubmitting={
        isSubmitting || createPillar.isPending || updatePillar.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Pillar Name"
        fullWidth
        required
        {...register('pillar_name')}
        error={!!errors.pillar_name}
        helperText={errors.pillar_name?.message}
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
