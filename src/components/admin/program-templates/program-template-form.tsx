'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import { programTemplateSchema, ProgramTemplateFormData } from '@/lib/validations/program-template';
import BaseForm from '@/components/forms/base-form';
import { useCreateProgramTemplate, useUpdateProgramTemplate } from '@/lib/hooks/use-program-templates';

interface ProgramTemplateFormProps {
  initialValues?: Partial<ProgramTemplateFormData> & { program_template_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function ProgramTemplateForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: ProgramTemplateFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ProgramTemplateFormData>({
    resolver: zodResolver(programTemplateSchema),
    defaultValues: {
      program_template_name: '',
      description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const createTemplate = useCreateProgramTemplate();
  const updateTemplate = useUpdateProgramTemplate();

  const onSubmit = async (values: ProgramTemplateFormData) => {
    if (isEdit && initialValues?.program_template_id) {
      await updateTemplate.mutateAsync({
        id: initialValues.program_template_id,
        data: values,
      });
    } else {
      await createTemplate.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<ProgramTemplateFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createTemplate.isPending || updateTemplate.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Template Name"
        fullWidth
        required
        {...register('program_template_name')}
        error={!!errors.program_template_name}
        helperText={errors.program_template_name?.message}
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
