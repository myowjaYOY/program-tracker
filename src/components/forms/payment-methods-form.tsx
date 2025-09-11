'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import { PaymentMethodsFormData, paymentMethodsSchema } from '@/lib/validations/payment-methods';
import { useCreatePaymentMethods, useUpdatePaymentMethods } from '@/lib/hooks/use-payment-methods';
import BaseForm from './base-form';

interface PaymentMethodsFormProps {
  initialValues?: Partial<PaymentMethodsFormData> & { payment_method_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function PaymentMethodsForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: PaymentMethodsFormProps) {
  const isEdit = mode === 'edit';
  const createPaymentMethods = useCreatePaymentMethods();
  const updatePaymentMethods = useUpdatePaymentMethods();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<PaymentMethodsFormData>({
    resolver: zodResolver(paymentMethodsSchema),
    defaultValues: {
      payment_method_name: '',
      payment_method_description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const onSubmit = async (data: PaymentMethodsFormData) => {
    try {
      if (isEdit && initialValues?.payment_method_id) {
        await updatePaymentMethods.mutateAsync({
          id: initialValues.payment_method_id.toString(),
          data,
        });
      } else {
        await createPaymentMethods.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Error submitting payment methods form:', error);
    }
  };

  return (
    <BaseForm<PaymentMethodsFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting ||
        createPaymentMethods.isPending ||
        updatePaymentMethods.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Payment Method Name"
        fullWidth
        required
        {...register('payment_method_name')}
        error={!!errors.payment_method_name}
        helperText={errors.payment_method_name?.message}
      />

      <TextField
        label="Description"
        fullWidth
        multiline
        rows={3}
        {...register('payment_method_description')}
        error={!!errors.payment_method_description}
        helperText={errors.payment_method_description?.message}
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
