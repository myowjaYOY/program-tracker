'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import {
  therapyTypeSchema,
  TherapyTypeFormData,
} from '@/lib/validations/therapy-type';
import BaseForm from './base-form';
import {
  useCreateTherapyType,
  useUpdateTherapyType,
} from '@/lib/hooks/use-therapy-type';

interface TherapyTypeFormProps {
  initialValues?: Partial<TherapyTypeFormData> & { therapy_type_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function TherapyTypeForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: TherapyTypeFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<TherapyTypeFormData>({
    resolver: zodResolver(therapyTypeSchema) as any,
    defaultValues: {
      therapy_type_name: '',
      description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const createTherapyType = useCreateTherapyType();
  const updateTherapyType = useUpdateTherapyType();

  const onSubmit = async (values: TherapyTypeFormData) => {
    if (isEdit && initialValues?.therapy_type_id) {
      await updateTherapyType.mutateAsync({
        ...values,
        id: String(initialValues.therapy_type_id),
      });
    } else {
      await createTherapyType.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<TherapyTypeFormData>
      onSubmit={onSubmit}
      onCancel={onSuccess ? onSuccess : undefined}
      submitHandler={handleSubmit(onSubmit) as any}
      isSubmitting={
        isSubmitting ||
        createTherapyType.isPending ||
        updateTherapyType.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Therapy Type Name"
        fullWidth
        required
        {...register('therapy_type_name')}
        error={!!errors.therapy_type_name}
        helperText={errors.therapy_type_name?.message}
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
