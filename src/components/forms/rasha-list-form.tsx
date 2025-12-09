'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';

import { RashaListFormData, rashaListSchema } from '@/lib/validations/rasha-list';
import BaseForm from './base-form';
import { useCreateRashaList, useUpdateRashaList } from '@/lib/hooks/use-rasha-list';

interface RashaListFormProps {
  initialValues?: Partial<RashaListFormData> & { rasha_list_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function RashaListForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: RashaListFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<RashaListFormData>({
    resolver: zodResolver(rashaListSchema),
    defaultValues: {
      name: '',
      length: 0,
      active_flag: true,
      ...initialValues,
    },
  });

  const createRashaList = useCreateRashaList();
  const updateRashaList = useUpdateRashaList();

  const onSubmit = async (values: RashaListFormData) => {
    if (isEdit && initialValues?.rasha_list_id) {
      await updateRashaList.mutateAsync({
        ...values,
        id: String(initialValues.rasha_list_id),
      });
    } else {
      await createRashaList.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<RashaListFormData>
      onSubmit={onSubmit}
      onCancel={onSuccess ? onSuccess : undefined}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createRashaList.isPending || updateRashaList.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Name"
        fullWidth
        required
        {...register('name')}
        error={!!errors.name}
        helperText={errors.name?.message}
      />
      <TextField
        label="Length"
        fullWidth
        required
        type="number"
        {...register('length', { valueAsNumber: true })}
        error={!!errors.length}
        helperText={errors.length?.message}
        inputProps={{ min: 1, step: 1 }}
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

