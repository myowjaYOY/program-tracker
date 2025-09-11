'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel } from '@mui/material';

import { VendorFormData, vendorSchema } from '@/lib/validations/vendor';
import BaseForm from './base-form';
import { useCreateVendor, useUpdateVendor } from '@/lib/hooks/use-vendors';

interface VendorFormProps {
  initialValues?: Partial<VendorFormData> & { vendor_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function VendorForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: VendorFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      vendor_name: '',
      contact_person: '',
      phone: '',
      email: '',
      active_flag: true,
      ...initialValues,
    },
  });

  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();

  // Phone formatting function
  const formatPhoneNumber = (value: string) => {
    const phone = value.replace(/\D/g, '');
    if (phone.length === 0) return '';
    if (phone.length <= 3) return `(${phone}`;
    if (phone.length <= 6) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setValue('phone', formatted);
  };

  const onSubmit = async (values: VendorFormData) => {
    if (isEdit && initialValues?.vendor_id) {
      await updateVendor.mutateAsync({
        ...values,
        id: String(initialValues.vendor_id),
      });
    } else {
      await createVendor.mutateAsync(values);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<VendorFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createVendor.isPending || updateVendor.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Vendor Name"
        fullWidth
        required
        {...register('vendor_name')}
        error={!!errors.vendor_name}
        helperText={errors.vendor_name?.message}
      />
      <TextField
        label="Contact Person"
        fullWidth
        required
        {...register('contact_person')}
        error={!!errors.contact_person}
        helperText={errors.contact_person?.message}
      />
      <TextField
        label="Phone"
        fullWidth
        required
        {...register('phone')}
        onChange={handlePhoneChange}
        error={!!errors.phone}
        helperText={errors.phone?.message}
        placeholder="(555) 123-4567"
      />
      <TextField
        label="Email"
        fullWidth
        {...register('email')}
        error={!!errors.email}
        helperText={errors.email?.message}
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
