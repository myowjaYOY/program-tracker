'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel, MenuItem } from '@mui/material';
import { TherapyFormData, therapySchema } from '@/lib/validations/therapy';
import BaseForm from './base-form';
import { useCreateTherapy, useUpdateTherapy } from '@/lib/hooks/use-therapies';
import { useActiveTherapyTypes } from '@/lib/hooks/use-therapy-type';
import { useActiveBuckets } from '@/lib/hooks/use-buckets';
import { useActiveProgramRoles } from '@/lib/hooks/use-program-roles';

interface TherapyFormProps {
  initialValues?: Partial<TherapyFormData> & { therapy_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function TherapyForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: TherapyFormProps) {
  const isEdit = mode === 'edit';
  const { data: therapyTypes = [], isLoading: therapyTypesLoading } =
    useActiveTherapyTypes();
  const { data: buckets = [], isLoading: bucketsLoading } = useActiveBuckets();
  const { data: programRoles = [], isLoading: programRolesLoading } = useActiveProgramRoles();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    control,
  } = useForm<TherapyFormData>({
    resolver: zodResolver(therapySchema),
    defaultValues: {
      therapy_name: initialValues?.therapy_name || '',
      description: initialValues?.description || '',
      therapy_type_id: initialValues?.therapy_type_id || 0,
      bucket_id: initialValues?.bucket_id || 0,
      program_role_id: initialValues?.program_role_id || 2,
      cost: initialValues?.cost || 0,
      charge: initialValues?.charge || 0,
      active_flag: initialValues?.active_flag ?? true,
      taxable: initialValues?.taxable ?? false,
    },
  });

  const createTherapy = useCreateTherapy();
  const updateTherapy = useUpdateTherapy();

  // Ensure program_role_id is set when editing
  useEffect(() => {
    if (isEdit && initialValues?.program_role_id) {
      setValue('program_role_id', initialValues.program_role_id);
    }
  }, [isEdit, initialValues?.program_role_id, setValue]);

  // Show loading state while data is being fetched
  if (therapyTypesLoading || bucketsLoading || programRolesLoading) {
    return (
      <BaseForm<TherapyFormData>
        onSubmit={() => {}}
        submitHandler={() => {}}
        isSubmitting={true}
        submitText="Loading..."
      >
        <div>Loading form data...</div>
      </BaseForm>
    );
  }

  const onSubmit = async (values: TherapyFormData) => {
    if (isEdit && initialValues?.therapy_id) {
      await updateTherapy.mutateAsync({
        ...values,
        id: String(initialValues.therapy_id),
      });
    } else {
      await createTherapy.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<TherapyFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createTherapy.isPending || updateTherapy.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Therapy Name"
        fullWidth
        required
        {...register('therapy_name')}
        error={!!errors.therapy_name}
        helperText={errors.therapy_name?.message}
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
      <Controller
        name="therapy_type_id"
        control={control}
        render={({ field }) => (
          <TextField
            label="Therapy Type"
            fullWidth
            select
            required
            {...field}
            value={field.value || 0}
            error={!!errors.therapy_type_id}
            helperText={errors.therapy_type_id?.message}
          >
            <MenuItem value={0}>Select Therapy Type</MenuItem>
            {therapyTypes.map((type: any) => (
              <MenuItem key={type.therapy_type_id} value={type.therapy_type_id}>
                {type.therapy_type_name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <Controller
        name="bucket_id"
        control={control}
        render={({ field }) => (
          <TextField
            label="Bucket"
            fullWidth
            select
            required
            {...field}
            value={field.value || 0}
            error={!!errors.bucket_id}
            helperText={errors.bucket_id?.message}
          >
            <MenuItem value={0}>Select Bucket</MenuItem>
            {buckets.map((bucket: any) => (
              <MenuItem key={bucket.bucket_id} value={bucket.bucket_id}>
                {bucket.bucket_name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <Controller
        name="program_role_id"
        control={control}
        render={({ field }) => (
          <TextField
            label="Responsible Role"
            fullWidth
            select
            required
            {...field}
            onChange={(e) => field.onChange(Number(e.target.value))}
            value={field.value || 2}
            error={!!errors.program_role_id}
            helperText={errors.program_role_id?.message}
          >
            {programRoles
              .slice()
              .sort((a: any, b: any) => a.role_name.localeCompare(b.role_name))
              .map((role: any) => (
                <MenuItem key={role.program_role_id} value={role.program_role_id}>
                  {role.role_name}
                </MenuItem>
              ))}
          </TextField>
        )}
      />
      <TextField
        label="Cost"
        fullWidth
        type="number"
        required
        inputProps={{ min: 0, step: 0.01 }}
        {...register('cost', { valueAsNumber: true })}
        error={!!errors.cost}
        helperText={errors.cost?.message}
      />
      <TextField
        label="Charge"
        fullWidth
        type="number"
        required
        inputProps={{ min: 0, step: 0.01 }}
        {...register('charge', { valueAsNumber: true })}
        error={!!errors.charge}
        helperText={errors.charge?.message}
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
      <FormControlLabel
        control={
          <Switch
            color="primary"
            checked={!!watch('taxable')}
            onChange={(_, checked) => setValue('taxable', checked)}
          />
        }
        label="Taxable"
      />
    </BaseForm>
  );
}
