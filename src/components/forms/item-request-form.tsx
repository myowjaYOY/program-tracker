'use client';

import React, { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, MenuItem, Grid } from '@mui/material';
import BaseForm from './base-form';
import {
  itemRequestSchema,
  type ItemRequestFormData,
} from '@/lib/validations/item-requests';
import {
  useCreateItemRequest,
  useUpdateItemRequest,
} from '@/lib/hooks/use-item-requests';
import { useMemberPrograms } from '@/lib/hooks/use-member-programs';

interface ItemRequestFormProps {
  initialValues?: Partial<ItemRequestFormData> & {
    item_request_id?: number;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
}

export default function ItemRequestForm({
  initialValues,
  onSuccess,
  onCancel,
  mode = 'create',
}: ItemRequestFormProps) {
  const isEdit = mode === 'edit';

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ItemRequestFormData>({
    resolver: zodResolver(itemRequestSchema),
    defaultValues: {
      lead_id: initialValues?.lead_id ?? null,
      item_description: initialValues?.item_description ?? '',
      quantity: initialValues?.quantity ?? 1,
      notes: initialValues?.notes ?? '',
    },
  });

  // Fetch member programs to get filtered members (same as coordinator/payments pages)
  const { data: allPrograms = [] } = useMemberPrograms();
  
  // Filter members: only leads with programs that are Active or Paused (same logic as coordinator/payments)
  const memberOptions = useMemo(() => {
    const included = new Set(['active', 'paused']);
    const filtered = (allPrograms || []).filter((p: any) =>
      included.has((p.status_name || '').toLowerCase())
    );
    const pairs = filtered
      .filter((p: any) => !!p.lead_id)
      .map((p: any) => ({
        id: p.lead_id as number,
        name: (p.lead_name as string) || `Lead #${p.lead_id}`,
      }));
    const seen = new Set<number>();
    const uniq: { id: number; name: string }[] = [];
    for (const pr of pairs) {
      if (!seen.has(pr.id)) {
        seen.add(pr.id);
        uniq.push(pr);
      }
    }
    return uniq;
  }, [allPrograms]);

  const createRequest = useCreateItemRequest();
  const updateRequest = useUpdateItemRequest();

  const onSubmit = async (values: ItemRequestFormData) => {
    try {
      if (isEdit && initialValues?.item_request_id) {
        await updateRequest.mutateAsync({
          id: initialValues.item_request_id,
          ...values,
        });
      } else {
        await createRequest.mutateAsync(values);
      }
      onSuccess?.();
    } catch (error) {
      // Error handling is done in the hooks with toast notifications
      console.error('Form submission error:', error);
    }
  };

  return (
    <BaseForm<ItemRequestFormData>
      onSubmit={onSubmit}
      onCancel={onCancel || (() => {})}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || createRequest.isPending || updateRequest.isPending}
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <Grid container spacing={2}>
        {/* Item Description - First field, full width */}
        <Grid size={12}>
          <TextField
            label="Item Description"
            fullWidth
            multiline
            rows={3}
            required
            placeholder="e.g., Vitamin D3 5000 IU supplements"
            {...register('item_description')}
            error={!!errors.item_description}
            helperText={errors.item_description?.message}
          />
        </Grid>

        {/* Quantity - Left side of second row */}
        <Grid size={6}>
          <TextField
            label="Quantity"
            type="number"
            fullWidth
            required
            inputProps={{ min: 1, max: 1000 }}
            {...register('quantity', { valueAsNumber: true })}
            error={!!errors.quantity}
          />
        </Grid>

        {/* Member/Lead Selection - Right side of second row */}
        <Grid size={6}>
          <Controller
            name="lead_id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Member (Optional)"
                fullWidth
                error={!!errors.lead_id}
                helperText={errors.lead_id?.message}
                value={field.value ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value === '' ? null : Number(value));
                }}
              >
                <MenuItem value="">
                  <em>None (General Request)</em>
                </MenuItem>
                {memberOptions.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>

        {/* Notes - Last field, full width */}
        <Grid size={12}>
          <TextField
            label="Notes (Optional)"
            fullWidth
            multiline
            rows={3}
            placeholder="Additional information or context"
            {...register('notes')}
            error={!!errors.notes}
          />
        </Grid>
      </Grid>
    </BaseForm>
  );
}



