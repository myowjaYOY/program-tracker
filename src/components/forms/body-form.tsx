'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import { BodyFormData, bodySchema } from '@/lib/validations/body';
import BaseForm from './base-form';
import { useCreateBody, useUpdateBody } from '@/lib/hooks/use-bodies';

interface BodyFormProps {
  initialValues?: Partial<BodyFormData> & { body_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function BodyForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: BodyFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<BodyFormData>({
    resolver: zodResolver(bodySchema) as any,
    defaultValues: {
      body_name: '',
      description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const createBody = useCreateBody();
  const updateBody = useUpdateBody();

  const onSubmit = async (values: BodyFormData) => {
    if (isEdit && initialValues?.body_id) {
      await updateBody.mutateAsync({
        ...values,
        id: String(initialValues.body_id),
      });
    } else {
      await createBody.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<BodyFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit) as any}
      isSubmitting={
        isSubmitting || createBody.isPending || updateBody.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Body Name"
        fullWidth
        required
        {...register('body_name')}
        error={!!errors.body_name}
        helperText={errors.body_name?.message}
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
