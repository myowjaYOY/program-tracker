'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel, MenuItem } from '@mui/material';
import { LeadFormData, leadSchema } from '@/lib/validations/lead';
import BaseForm from './base-form';
import { useCreateLead, useUpdateLead } from '@/lib/hooks/use-leads';
import { useActiveStatus } from '@/lib/hooks/use-status';
import { useActiveCampaigns } from '@/lib/hooks/use-campaigns';

interface LeadFormProps {
  initialValues?: Partial<LeadFormData> & { lead_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function LeadForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: LeadFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    control,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      status_id: 0,
      campaign_id: 0,
      pmedate: '',
      active_flag: true,
      ...initialValues,
    } as LeadFormData,
  });

  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const { data: statuses } = useActiveStatus();
  const { data: campaigns } = useActiveCampaigns();

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

const onSubmit = async (values: LeadFormData) => {
    const leadData: LeadFormData = {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      phone: values.phone,
      status_id: values.status_id,
      campaign_id: values.campaign_id,
      pmedate: values.pmedate,
      active_flag: values.active_flag,
    };

    if (isEdit && initialValues?.lead_id) {
      await updateLead.mutateAsync({
        ...leadData,
        id: String(initialValues.lead_id),
      });
    } else {
      await createLead.mutateAsync(leadData);
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<LeadFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createLead.isPending || updateLead.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="First Name"
        fullWidth
        required
        {...register('first_name')}
        error={!!errors.first_name}
        helperText={errors.first_name?.message}
      />

      <TextField
        label="Last Name"
        fullWidth
        required
        {...register('last_name')}
        error={!!errors.last_name}
        helperText={errors.last_name?.message}
      />

      <TextField
        label="Email"
        fullWidth
        type="email"
        {...register('email')}
        error={!!errors.email}
        helperText={errors.email?.message}
      />

      <TextField
        label="Phone"
        fullWidth
        required
        {...register('phone')}
        error={!!errors.phone}
        helperText={errors.phone?.message}
        onChange={handlePhoneChange}
        placeholder="(555) 555-5555"
      />

      <Controller
        name="status_id"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            select
            label="Status"
            fullWidth
            required
            error={!!errors.status_id}
            helperText={errors.status_id?.message}
            value={field.value || ''}
            onChange={e => field.onChange(Number(e.target.value))}
          >
            <MenuItem value="">
              <em>Select a status</em>
            </MenuItem>
            {statuses?.map(status => (
              <MenuItem key={status.status_id} value={status.status_id}>
                {status.status_name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <Controller
        name="campaign_id"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            select
            label="Campaign"
            fullWidth
            required
            error={!!errors.campaign_id}
            helperText={errors.campaign_id?.message}
            value={field.value || ''}
            onChange={e => field.onChange(Number(e.target.value))}
          >
            <MenuItem value="">
              <em>Select a campaign</em>
            </MenuItem>
            {campaigns?.map(campaign => (
              <MenuItem key={campaign.campaign_id} value={campaign.campaign_id}>
                {campaign.campaign_name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <TextField
        label="PME Date"
        fullWidth
        type="date"
        InputLabelProps={{ shrink: true }}
        {...register('pmedate')}
        error={!!errors.pmedate}
        helperText={errors.pmedate?.message}
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
