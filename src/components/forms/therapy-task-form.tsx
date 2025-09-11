'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel, MenuItem } from '@mui/material';

import { TherapyTaskFormData, therapyTaskSchema } from '@/lib/validations/therapy-task';
import BaseForm from './base-form';
import { useCreateTherapyTask, useUpdateTherapyTask } from '@/lib/hooks/use-therapy-tasks';
import { useActiveTherapies } from '@/lib/hooks/use-therapies';

interface TherapyTaskFormProps {
  initialValues?: Partial<TherapyTaskFormData> & { task_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function TherapyTaskForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: TherapyTaskFormProps) {
  const isEdit = mode === 'edit';
  const { data: therapies = [], isLoading: therapiesLoading } = useActiveTherapies();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    control,
  } = useForm<TherapyTaskFormData>({
    resolver: zodResolver(therapyTaskSchema),
    defaultValues: {
      task_name: initialValues?.task_name || '',
      description: initialValues?.description || '',
      therapy_id: initialValues?.therapy_id || 0,
      task_delay: initialValues?.task_delay || 0,
      active_flag: initialValues?.active_flag ?? true,
    },
  });

  const createTherapyTask = useCreateTherapyTask();
  const updateTherapyTask = useUpdateTherapyTask();

  // Show loading state while data is being fetched
  if (therapiesLoading) {
    return (
      <BaseForm<TherapyTaskFormData>
        onSubmit={() => {}}
        submitHandler={() => {}}
        isSubmitting={true}
        submitText="Loading..."
      >
        <div>Loading form data...</div>
      </BaseForm>
    );
  }

  const onSubmit = async (values: TherapyTaskFormData) => {
    if (isEdit && initialValues?.task_id) {
      await updateTherapyTask.mutateAsync({
        ...values,
        id: String(initialValues.task_id),
      });
    } else {
      await createTherapyTask.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<TherapyTaskFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createTherapyTask.isPending || updateTherapyTask.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <Controller
        name="therapy_id"
        control={control}
        render={({ field }) => (
          <TextField
            label="Therapy"
            fullWidth
            select
            required
            {...field}
            value={field.value || 0}
            error={!!errors.therapy_id}
            helperText={errors.therapy_id?.message}
          >
            <MenuItem value={0}>Select a therapy...</MenuItem>
            {therapies.map((therapy: any) => (
              <MenuItem key={therapy.therapy_id} value={therapy.therapy_id}>
                {therapy.therapy_name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <TextField
        label="Task Name"
        fullWidth
        required
        {...register('task_name')}
        error={!!errors.task_name}
        helperText={errors.task_name?.message}
      />
      
      <TextField
        label="Description"
        fullWidth
        multiline
        rows={3}
        {...register('description')}
        error={!!errors.description}
        helperText={errors.description?.message}
      />

      <TextField
        label="Task Delay (days)"
        fullWidth
        required
        type="number"
        {...register('task_delay', { valueAsNumber: true })}
        error={!!errors.task_delay}
        helperText={errors.task_delay?.message || 'Negative values mean before therapy, positive values mean after therapy'}
        inputProps={{ min: -365, max: 365 }}
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
