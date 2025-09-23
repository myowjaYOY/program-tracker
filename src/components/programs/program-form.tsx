'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Switch, FormControlLabel, MenuItem } from '@mui/material';
import {
  memberProgramSchema,
  MemberProgramFormData,
} from '@/lib/validations/member-program';
import BaseForm from '@/components/forms/base-form';
import {
  useCreateMemberProgram,
  useUpdateMemberProgram,
} from '@/lib/hooks/use-member-programs';
import { useActiveLeads } from '@/lib/hooks/use-leads';
import { useActiveProgramStatus } from '@/lib/hooks/use-program-status';

interface ProgramFormProps {
  initialValues?: Partial<MemberProgramFormData> & {
    member_program_id?: number;
  };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function ProgramForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: ProgramFormProps) {
  const isEdit = mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<MemberProgramFormData>({
    resolver: zodResolver(memberProgramSchema),
    defaultValues: {
      program_template_name: '',
      description: '',
      lead_id: null,
      start_date: null,
      program_status_id: null,
      active_flag: true,
      ...initialValues,
    },
  });

  const createProgram = useCreateMemberProgram();
  const updateProgram = useUpdateMemberProgram();
  const { data: leads = [] } = useActiveLeads();
  const { data: programStatuses = [] } = useActiveProgramStatus();

  const onSubmit = async (values: MemberProgramFormData) => {
    if (isEdit && initialValues?.member_program_id) {
      await updateProgram.mutateAsync({
        id: initialValues.member_program_id.toString(),
        data: {
          ...values,
          description: values.description || null,
        },
      });
    } else {
      await createProgram.mutateAsync({
        ...values,
        description: values.description || null,
      });
    }
    if (onSuccess) onSuccess();
  };

  return (
    <BaseForm<MemberProgramFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createProgram.isPending || updateProgram.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Program Name"
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
      <TextField
        select
        label="Lead"
        fullWidth
        {...register('lead_id')}
        error={!!errors.lead_id}
        helperText={errors.lead_id?.message}
      >
        <MenuItem value="">
          <em>Select a lead</em>
        </MenuItem>
        {leads.map(lead => (
          <MenuItem key={lead.lead_id} value={lead.lead_id}>
            {lead.first_name} {lead.last_name} ({lead.email})
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Start Date"
        type="date"
        fullWidth
        InputLabelProps={{ shrink: true }}
        {...register('start_date')}
        error={!!errors.start_date}
        helperText={errors.start_date?.message}
      />
      <TextField
        select
        label="Program Status"
        fullWidth
        {...register('program_status_id')}
        error={!!errors.program_status_id}
        helperText={errors.program_status_id?.message}
      >
        <MenuItem value="">
          <em>Select a status</em>
        </MenuItem>
        {programStatuses.map(status => (
          <MenuItem
            key={status.program_status_id}
            value={status.program_status_id}
          >
            {status.status_name}
          </MenuItem>
        ))}
      </TextField>
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
