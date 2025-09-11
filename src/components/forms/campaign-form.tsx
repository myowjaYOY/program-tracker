'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { CampaignFormData, campaignSchema } from '@/lib/validations/campaign';
import BaseForm from './base-form';
import {
  useCreateCampaign,
  useUpdateCampaign,
} from '@/lib/hooks/use-campaigns';
import { useActiveVendors } from '@/lib/hooks/use-vendors';

interface CampaignFormProps {
  initialValues?: Partial<CampaignFormData> & { campaign_id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function CampaignForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: CampaignFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      campaign_name: '',
      campaign_date: new Date().toISOString().split('T')[0],
      description: '',
      confirmed_count: 0,
      vendor_id: 0, // Ensure default is 0
      ad_spend: null,
      food_cost: null,
      active_flag: true,
      ...initialValues,
    } as CampaignFormData,
  });

  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const { data: vendors = [], isLoading: vendorsLoading } = useActiveVendors();

  const onSubmit = async (values: any) => {
    const campaignData: CampaignFormData = {
      campaign_name: values.campaign_name,
      campaign_date: values.campaign_date,
      description: values.description,
      confirmed_count: values.confirmed_count,
      vendor_id: values.vendor_id,
      ad_spend: values.ad_spend,
      food_cost: values.food_cost,
      active_flag: values.active_flag,
    };

    if (isEdit && initialValues?.campaign_id) {
      await updateCampaign.mutateAsync({
        ...campaignData,
        id: String(initialValues.campaign_id),
      });
    } else {
      await createCampaign.mutateAsync(campaignData);
    }
    if (onSuccess) onSuccess();
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setValue('campaign_date', date.toISOString().split('T')[0] || '');
    } else {
      setValue('campaign_date', '');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <BaseForm<CampaignFormData>
        onSubmit={onSubmit}
        submitHandler={handleSubmit(onSubmit)}
        isSubmitting={
          isSubmitting || createCampaign.isPending || updateCampaign.isPending
        }
        submitText={isEdit ? 'Update' : 'Create'}
      >
        <TextField
          label="Campaign Name"
          fullWidth
          required
          {...register('campaign_name')}
          error={!!errors.campaign_name}
          helperText={errors.campaign_name?.message}
        />

        <DatePicker
          label="Campaign Date"
          value={
            watch('campaign_date') ? new Date(watch('campaign_date')!) : null
          }
          onChange={handleDateChange}
          slotProps={{
            textField: {
              fullWidth: true,
              required: true,
              error: !!errors.campaign_date,
              helperText: errors.campaign_date?.message,
            },
          }}
        />

        <TextField
          label="Description"
          fullWidth
          required
          multiline
          rows={3}
          {...register('description')}
          error={!!errors.description}
          helperText={errors.description?.message}
        />

        <TextField
          label="Confirmed Count"
          fullWidth
          required
          type="number"
          {...register('confirmed_count', { valueAsNumber: true })}
          error={!!errors.confirmed_count}
          helperText={errors.confirmed_count?.message}
        />

        <TextField
          select
          label="Vendor"
          fullWidth
          required
          {...register('vendor_id', { valueAsNumber: true })}
          value={watch('vendor_id') ?? 0} // Ensure controlled value is always set
          error={!!errors.vendor_id}
          helperText={errors.vendor_id?.message}
          disabled={vendorsLoading}
        >
          <MenuItem value={0} disabled>
            Select a vendor
          </MenuItem>
          {vendors.map(vendor => (
            <MenuItem key={vendor.vendor_id} value={vendor.vendor_id}>
              {vendor.vendor_name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Ad Spend"
          fullWidth
          type="number"
          {...register('ad_spend', { valueAsNumber: true })}
          error={!!errors.ad_spend}
          helperText={errors.ad_spend?.message}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
        />

        <TextField
          label="Food Cost"
          fullWidth
          type="number"
          {...register('food_cost', { valueAsNumber: true })}
          error={!!errors.food_cost}
          helperText={errors.food_cost?.message}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
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
    </LocalizationProvider>
  );
}
