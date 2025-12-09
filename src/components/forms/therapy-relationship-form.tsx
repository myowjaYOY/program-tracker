'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, MenuItem } from '@mui/material';
import {
  therapyRelationshipSchema,
  TherapyRelationshipFormData,
} from '@/lib/validations/therapy-relationships';
import BaseForm from './base-form';
import { useCreateTherapyRelationship } from '@/lib/hooks/use-therapy-relationships';
import { useActiveBodies } from '@/lib/hooks/use-bodies';
import { useActivePillars } from '@/lib/hooks/use-pillars';

interface TherapyRelationshipFormProps {
  therapyId: string;
  onSuccess?: () => void;
}

export default function TherapyRelationshipForm({
  therapyId,
  onSuccess,
}: TherapyRelationshipFormProps) {
  const { data: bodies = [], isLoading: bodiesLoading } = useActiveBodies();
  const { data: pillars = [], isLoading: pillarsLoading } = useActivePillars();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(therapyRelationshipSchema.omit({ therapy_id: true })),
    defaultValues: {
      body_id: 0,
      pillar_id: 0,
      active_flag: true,
    },
  });

  const createRelationship = useCreateTherapyRelationship(therapyId);

  const onSubmit = async (values: any) => {
    await createRelationship.mutateAsync(values);
    reset();
    if (onSuccess) onSuccess();
  };

  // Show loading state while data is being fetched
  if (bodiesLoading || pillarsLoading) {
    return (
      <BaseForm
        onSubmit={() => {}}
        submitHandler={() => {}}
        isSubmitting={true}
        submitText="Loading..."
      >
        <div>Loading form data...</div>
      </BaseForm>
    );
  }

  return (
    <BaseForm
      onSubmit={onSubmit}
      onCancel={onSuccess ? onSuccess : undefined}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting || createRelationship.isPending}
      submitText="Add Relationship"
    >
      <Controller
        name="body_id"
        control={control}
        render={({ field }) => (
          <TextField
            label="Body"
            fullWidth
            select
            required
            {...field}
            value={field.value || 0}
            error={!!errors.body_id}
            helperText={errors.body_id?.message}
          >
            <MenuItem value={0}>Select Body</MenuItem>
            {bodies.map((body: any) => (
              <MenuItem key={body.body_id} value={body.body_id}>
                {body.body_name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <Controller
        name="pillar_id"
        control={control}
        render={({ field }) => (
          <TextField
            label="Pillar"
            fullWidth
            select
            required
            {...field}
            value={field.value || 0}
            error={!!errors.pillar_id}
            helperText={errors.pillar_id?.message}
          >
            <MenuItem value={0}>Select Pillar</MenuItem>
            {pillars.map((pillar: any) => (
              <MenuItem key={pillar.pillar_id} value={pillar.pillar_id}>
                {pillar.pillar_name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </BaseForm>
  );
}
