'use client';

import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Grid, TextField, MenuItem, Box } from '@mui/material';
import BaseForm from './base-form';
import {
  MemberProgramPaymentsFormData,
  memberProgramPaymentsSchema,
} from '@/lib/validations/member-program-payments';
import { useActivePaymentMethods } from '@/lib/hooks/use-payment-methods';
import { useActivePaymentStatus } from '@/lib/hooks/use-payment-status';
import {
  useCreateMemberProgramPayment,
  useUpdateMemberProgramPayment,
} from '@/lib/hooks/use-member-program-payments';

interface MemberProgramPaymentFormProps {
  programId: number;
  initialValues?: Partial<MemberProgramPaymentsFormData> & {
    member_program_payment_id?: number;
  };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function MemberProgramPaymentForm({
  programId,
  initialValues,
  onSuccess,
  mode = 'create',
}: MemberProgramPaymentFormProps) {
  const isEdit = mode === 'edit';

  const normalizeDateInput = (value?: string | null): string => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const normalizedInitials = React.useMemo(
    () => ({
      ...initialValues,
      payment_due_date: normalizeDateInput(
        (initialValues as any)?.payment_due_date
      ),
      payment_date: normalizeDateInput((initialValues as any)?.payment_date),
    }),
    [initialValues]
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
    clearErrors,
    watch,
  } = useForm<MemberProgramPaymentsFormData>({
    resolver: zodResolver(memberProgramPaymentsSchema),
    defaultValues: {
      member_program_id: programId,
      payment_amount: 0,
      payment_due_date:
        normalizeDateInput((initialValues as any)?.payment_due_date) || '',
      payment_date:
        normalizeDateInput((initialValues as any)?.payment_date) || undefined,
      payment_status_id: undefined as unknown as number,
      payment_method_id: undefined as unknown as number,
      payment_reference: '',
      notes: '',
      ...(normalizedInitials as any),
      member_program_id: programId,
    },
  });

  React.useEffect(() => {
    // Ensure fields populate when editing and when modal re-opens
    reset({
      member_program_id: programId,
      payment_amount: (normalizedInitials as any)?.payment_amount ?? 0,
      payment_due_date:
        normalizeDateInput((normalizedInitials as any)?.payment_due_date) || '',
      payment_date:
        normalizeDateInput((normalizedInitials as any)?.payment_date) ||
        undefined,
      payment_status_id: (normalizedInitials as any)?.payment_status_id as any,
      payment_method_id: (normalizedInitials as any)?.payment_method_id as any,
      payment_reference: (normalizedInitials as any)?.payment_reference || '',
      notes: (normalizedInitials as any)?.notes || '',
    });
  }, [normalizedInitials, programId, reset]);

  const { data: statusOptions = [] } = useActivePaymentStatus();
  const { data: methodOptions = [] } = useActivePaymentMethods();

  const createPayment = useCreateMemberProgramPayment(programId);
  const updatePayment = useUpdateMemberProgramPayment(programId);

  const watchedStatusId = watch('payment_status_id');
  const isPaidSelected = React.useMemo(() => {
    const sel = (statusOptions as any[]).find((s: any) => {
      const sid = (s.payment_status_id ?? (s.status_id as any)) as number;
      return sid === (watchedStatusId as unknown as number);
    });
    const name = (sel?.status_name || sel?.payment_status_name || '')
      .toString()
      .toLowerCase();
    return name === 'paid';
  }, [watchedStatusId, statusOptions]);

  const onSubmit = async (values: MemberProgramPaymentsFormData) => {
    const selectedStatus = (statusOptions as any[]).find((s: any) => {
      const sid = (s.payment_status_id ?? (s.status_id as any)) as number;
      return sid === (values.payment_status_id as unknown as number);
    });
    const statusName = (
      selectedStatus?.status_name ||
      selectedStatus?.payment_status_name ||
      ''
    )
      .toString()
      .toLowerCase();
    const isPaid = statusName === 'paid';

    // Enforce Paid Date when status is Paid
    if (isPaid && !values.payment_date) {
      setError('payment_date', {
        type: 'required',
        message: 'Paid Date is required when status is Paid',
      });
      return;
    }

    const payload: MemberProgramPaymentsFormData = {
      ...values,
      // Ensure paid date is null unless status is Paid
      payment_date: isPaid ? values.payment_date || null : null,
    };

    if (isEdit && initialValues?.member_program_payment_id) {
      await updatePayment.mutateAsync({
        id: initialValues.member_program_payment_id,
        ...payload,
      });
    } else {
      await createPayment.mutateAsync(payload);
    }
    onSuccess?.();
  };

  return (
    <BaseForm<MemberProgramPaymentsFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting || createPayment.isPending || updatePayment.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <Grid item xs={12}>
        <Box
          sx={theme => ({
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            columnGap: theme.spacing(2),
            rowGap: theme.spacing(2),
            alignItems: 'start',
          })}
        >
          <TextField
            label="Due Date"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            disabled
            {...register('payment_due_date')}
            error={!!errors.payment_due_date}
            helperText={errors.payment_due_date?.toString()}
          />
          <TextField
            label="Amount"
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 0.01 }}
            disabled
            {...register('payment_amount', { valueAsNumber: true })}
            error={!!errors.payment_amount}
            helperText={errors.payment_amount?.toString()}
          />

          <TextField
            label="Paid Date"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            {...register('payment_date')}
            error={!!errors.payment_date}
            helperText={errors.payment_date?.toString()}
            required={isPaidSelected}
          />
          <Controller
            name="payment_status_id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Status"
                fullWidth
                required
                error={!!errors.payment_status_id}
                helperText={errors.payment_status_id?.toString()}
                value={field.value || ''}
                onChange={e => {
                  clearErrors('payment_date');
                  field.onChange(Number(e.target.value));
                }}
              >
                <MenuItem value="">
                  <em>Select status</em>
                </MenuItem>
                {statusOptions.map((s: any) => (
                  <MenuItem
                    key={s.payment_status_id}
                    value={s.payment_status_id}
                  >
                    {s.status_name || s.payment_status_name || s.status_name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {/* Left column rows 3-4 merged to keep tight spacing between Method and Reference */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              gridRow: { xs: 'auto', sm: 'span 2' },
            }}
          >
            <Controller
              name="payment_method_id"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Method"
                  fullWidth
                  required
                  error={!!errors.payment_method_id}
                  helperText={errors.payment_method_id?.toString()}
                  value={field.value || ''}
                  onChange={e => field.onChange(Number(e.target.value))}
                >
                  <MenuItem value="">
                    <em>Select method</em>
                  </MenuItem>
                  {methodOptions.map((m: any) => (
                    <MenuItem
                      key={m.payment_method_id}
                      value={m.payment_method_id}
                    >
                      {m.method_name || m.payment_method_name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField
              label="Reference"
              fullWidth
              {...register('payment_reference')}
              error={!!errors.payment_reference}
              helperText={errors.payment_reference?.toString()}
            />
          </Box>

          {/* Right column rows 3-4: Notes, about 25% shorter than full height */}
          <TextField
            label="Notes"
            fullWidth
            multiline
            minRows={4}
            {...register('notes')}
            error={!!errors.notes}
            helperText={errors.notes?.toString()}
            sx={{ gridRow: { xs: 'auto', sm: 'span 2' } }}
          />
        </Box>
      </Grid>
    </BaseForm>
  );
}
