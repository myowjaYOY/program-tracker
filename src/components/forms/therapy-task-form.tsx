'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  CircularProgress,
} from '@mui/material';

import {
  TherapyTaskFormData,
  therapyTaskFormSchema,
} from '@/lib/validations/therapy-task';
import BaseForm from './base-form';
import {
  useCreateTherapyTask,
  useUpdateTherapyTask,
} from '@/lib/hooks/use-therapy-tasks';
import { useActiveTherapies } from '@/lib/hooks/use-therapies';
import { useActiveTherapyTypes } from '@/lib/hooks/use-therapy-types';
import { useActiveProgramRoles } from '@/lib/hooks/use-program-roles';

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
  const { data: therapyTypes = [], isLoading: therapyTypesLoading } =
    useActiveTherapyTypes();
  const { data: allTherapies = [], isLoading: therapiesLoading } =
    useActiveTherapies();
  const { data: programRoles = [], isLoading: programRolesLoading } =
    useActiveProgramRoles();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    control,
  } = useForm<TherapyTaskFormData>({
    resolver: zodResolver(therapyTaskFormSchema) as any,
    defaultValues: {
      therapy_type_id: initialValues?.therapy_type_id || 0,
      therapy_id: initialValues?.therapy_id || 0,
      task_name: initialValues?.task_name || '',
      description: initialValues?.description || '',
      task_delay: initialValues?.task_delay || 0,
      program_role_id: initialValues?.program_role_id || 2,
      active_flag: initialValues?.active_flag ?? true,
    },
  });

  const selectedTherapyTypeId = watch('therapy_type_id');
  const selectedTherapyId = watch('therapy_id');

  const createTherapyTask = useCreateTherapyTask();
  const updateTherapyTask = useUpdateTherapyTask();

  // Filter therapies based on selected therapy type
  const filteredTherapies = selectedTherapyTypeId
    ? allTherapies.filter(
        t => t.therapy_type_id === selectedTherapyTypeId && t.active_flag
      )
    : [];

  // Reset therapy selection when therapy type changes (only in create mode)
  const handleTherapyTypeChange = (therapyTypeId: number) => {
    if (!isEdit) {
      setValue('therapy_id', 0);
    }
  };

  // Ensure program_role_id is set when editing
  useEffect(() => {
    if (isEdit && initialValues?.program_role_id) {
      setValue('program_role_id', initialValues.program_role_id);
    }
  }, [isEdit, initialValues?.program_role_id, setValue]);

  // Show loading state while data is being fetched
  if (therapiesLoading || therapyTypesLoading || programRolesLoading) {
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
    // Remove therapy_type_id from the data sent to the API since it's not stored in therapy_tasks
    const { therapy_type_id, ...apiData } = values;
    
    if (isEdit && initialValues?.task_id) {
      await updateTherapyTask.mutateAsync({
        ...apiData,
        id: String(initialValues.task_id),
      });
    } else {
      await createTherapyTask.mutateAsync(apiData as any);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<TherapyTaskFormData>
      onSubmit={onSubmit}
      onCancel={onSuccess ? onSuccess : undefined}
      submitHandler={handleSubmit(onSubmit) as any}
      isSubmitting={
        isSubmitting ||
        createTherapyTask.isPending ||
        updateTherapyTask.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
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
            disabled={isEdit}
            onChange={e => {
              const value = Number(e.target.value);
              field.onChange(value);
              handleTherapyTypeChange(value);
            }}
          >
            <MenuItem value={0}>Select a therapy type...</MenuItem>
            {therapyTypes
              .sort((a, b) =>
                a.therapy_type_name.localeCompare(b.therapy_type_name)
              )
              .map(therapyType => (
                <MenuItem
                  key={therapyType.therapy_type_id}
                  value={therapyType.therapy_type_id}
                >
                  {therapyType.therapy_type_name}
                </MenuItem>
              ))}
          </TextField>
        )}
      />

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
            helperText={
              errors.therapy_id?.message ||
              (!selectedTherapyTypeId && !isEdit
                ? 'Select a therapy type first'
                : undefined)
            }
            disabled={isEdit || !selectedTherapyTypeId}
            InputProps={{
              endAdornment: therapiesLoading ? (
                <CircularProgress size={20} />
              ) : null,
            }}
          >
            <MenuItem value={0}>Select a therapy...</MenuItem>
            {filteredTherapies
              .sort((a, b) => a.therapy_name.localeCompare(b.therapy_name))
              .map(therapy => (
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
        helperText={
          errors.task_name?.message ||
          (!selectedTherapyId && !isEdit
            ? 'Select a therapy first'
            : undefined)
        }
        disabled={!selectedTherapyId}
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
          (!selectedTherapyId && !isEdit
            ? 'Select a therapy first'
            : undefined)
        }
        disabled={!selectedTherapyId}
      />

      <TextField
        label="Task Delay (days)"
        fullWidth
        required
        type="number"
        {...register('task_delay', { valueAsNumber: true })}
        error={!!errors.task_delay}
        helperText={
          errors.task_delay?.message ||
          (!selectedTherapyId && !isEdit
            ? 'Select a therapy first'
            : 'Negative values mean before therapy, positive values mean after therapy')
        }
        inputProps={{ min: -365, max: 365 }}
        disabled={!selectedTherapyId}
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
            disabled={!selectedTherapyId}
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

      <FormControlLabel
        control={
          <Switch
            color="primary"
            checked={!!watch('active_flag')}
            onChange={(_, checked) => setValue('active_flag', checked)}
            disabled={!selectedTherapyId}
          />
        }
        label="Active"
      />
    </BaseForm>
  );
}
