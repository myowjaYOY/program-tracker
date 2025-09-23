'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';
import {
  PaymentStatusFormData,
  paymentStatusSchema,
} from '@/lib/validations/payment-status';
import {
  useCreatePaymentStatus,
  useUpdatePaymentStatus,
} from '@/lib/hooks/use-payment-status';
import BaseForm from './base-form';

interface PaymentStatusFormProps {
  initialValues?: Partial<PaymentStatusFormData> & {
    payment_status_id?: number;
  };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function PaymentStatusForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: PaymentStatusFormProps) {
  const isEdit = mode === 'edit';
  const createPaymentStatus = useCreatePaymentStatus();
  const updatePaymentStatus = useUpdatePaymentStatus();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<PaymentStatusFormData>({
    resolver: zodResolver(paymentStatusSchema),
    defaultValues: {
      payment_status_name: '',
      payment_status_description: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const onSubmit = async (data: PaymentStatusFormData) => {
    try {
      if (isEdit && initialValues?.payment_status_id) {
        await updatePaymentStatus.mutateAsync({
          id: initialValues.payment_status_id.toString(),
          data,
        });
      } else {
        await createPaymentStatus.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Error submitting payment status form:', error);
    }
  };

  return (
    <BaseForm<PaymentStatusFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting ||
        createPaymentStatus.isPending ||
        updatePaymentStatus.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Payment Status Name"
        fullWidth
        required
        {...register('payment_status_name')}
        error={!!errors.payment_status_name}
        helperText={errors.payment_status_name?.message}
      />

      <TextField
        label="Description"
        fullWidth
        multiline
        rows={3}
        {...register('payment_status_description')}
        error={!!errors.payment_status_description}
        helperText={errors.payment_status_description?.message}
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
