'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import { BucketFormData, bucketSchema } from '@/lib/validations/bucket';
import BaseForm from './base-form';
import { useCreateBucket, useUpdateBucket } from '@/lib/hooks/use-buckets';

interface BucketFormProps {
  initialValues?: Partial<BucketFormData> & { bucket_id?: string };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function BucketForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: BucketFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<BucketFormData>({
    resolver: zodResolver(bucketSchema),
    defaultValues: {
      bucket_name: '',
      description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const createBucket = useCreateBucket();
  const updateBucket = useUpdateBucket();

  const onSubmit = async (values: BucketFormData) => {
    if (isEdit && initialValues?.bucket_id) {
      await updateBucket.mutateAsync({
        id: initialValues.bucket_id,
        data: values,
      });
    } else {
      await createBucket.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<BucketFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createBucket.isPending || updateBucket.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Bucket Name"
        fullWidth
        required
        {...register('bucket_name')}
        error={!!errors.bucket_name}
        helperText={errors.bucket_name?.message}
      />
      <TextField
        label="Description"
        fullWidth
        multiline
        minRows={2}
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
