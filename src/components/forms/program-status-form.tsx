'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import {
  ProgramStatusFormData,
  programStatusSchema,
} from '@/lib/validations/program-status';
import BaseForm from './base-form';
import {
  useCreateProgramStatus,
  useUpdateProgramStatus,
} from '@/lib/hooks/use-program-status';

interface ProgramStatusFormProps {
  initialValues?: Partial<ProgramStatusFormData> & {
    program_status_id?: number;
  };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function ProgramStatusForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: ProgramStatusFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ProgramStatusFormData>({
    resolver: zodResolver(programStatusSchema) as any,
    defaultValues: {
      status_name: '',
      description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const createProgramStatus = useCreateProgramStatus();
  const updateProgramStatus = useUpdateProgramStatus();

  const onSubmit = async (values: ProgramStatusFormData) => {
    if (isEdit && initialValues?.program_status_id) {
      await updateProgramStatus.mutateAsync({
        ...values,
        id: String(initialValues.program_status_id),
      });
    } else {
      await createProgramStatus.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<ProgramStatusFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit) as any}
      isSubmitting={
        isSubmitting ||
        createProgramStatus.isPending ||
        updateProgramStatus.isPending
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
