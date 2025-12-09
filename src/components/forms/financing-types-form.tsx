'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel, MenuItem } from '@mui/material';
import {
  FinancingTypesFormData,
  financingTypesSchema,
} from '@/lib/validations/financing-types';
import {
  useCreateFinancingTypes,
  useUpdateFinancingTypes,
} from '@/lib/hooks/use-financing-types';
import BaseForm from './base-form';

interface FinancingTypesFormProps {
  initialValues?: Partial<FinancingTypesFormData> & {
    financing_type_id?: number;
  };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function FinancingTypesForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: FinancingTypesFormProps) {
  const isEdit = mode === 'edit';
  const createFinancingTypes = useCreateFinancingTypes();
  const updateFinancingTypes = useUpdateFinancingTypes();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<FinancingTypesFormData>({
    resolver: zodResolver(financingTypesSchema) as any,
    defaultValues: {
      financing_type_name: '',
      financing_type_description: '',
      financing_source: 'internal',
      active_flag: true,
      ...initialValues,
    },
  });

  const onSubmit = async (data: FinancingTypesFormData) => {
    try {
      if (isEdit && initialValues?.financing_type_id) {
        await updateFinancingTypes.mutateAsync({
          id: initialValues.financing_type_id.toString(),
          data,
        });
      } else {
        await createFinancingTypes.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Error submitting financing types form:', error);
    }
  };

  return (
    <BaseForm<FinancingTypesFormData>
      onSubmit={onSubmit}
      onCancel={onSuccess ? onSuccess : undefined}
      submitHandler={handleSubmit(onSubmit) as any}
      isSubmitting={
        isSubmitting ||
        createFinancingTypes.isPending ||
        updateFinancingTypes.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Financing Type Name"
        fullWidth
        required
        {...register('financing_type_name')}
        error={!!errors.financing_type_name}
        helperText={errors.financing_type_name?.message}
      />

      <TextField
        label="Description"
        fullWidth
        multiline
        rows={3}
        {...register('financing_type_description')}
        error={!!errors.financing_type_description}
        helperText={errors.financing_type_description?.message}
      />

      <Controller
        name="financing_source"
        control={control}
        render={({ field }) => (
          <TextField
            select
            label="Financing Source"
            fullWidth
            required
            value={field.value || 'internal'}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={!!errors.financing_source}
            helperText={errors.financing_source?.message}
          >
            <MenuItem value="internal">Internal</MenuItem>
            <MenuItem value="external">External</MenuItem>
          </TextField>
        )}
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
