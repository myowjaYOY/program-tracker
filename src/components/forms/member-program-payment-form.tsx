'use client';

import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Grid, TextField, MenuItem, Box, Alert, Typography, Chip } from '@mui/material';
import BaseForm from './base-form';
import {
  MemberProgramPaymentsFormData,
  memberProgramPaymentsFormSchema,
} from '@/lib/validations/member-program-payments';
import { useActivePaymentMethods } from '@/lib/hooks/use-payment-methods';
import { useActivePaymentStatus } from '@/lib/hooks/use-payment-status';
import {
  useCreateMemberProgramPayment,
  useUpdateMemberProgramPayment,
  useMemberProgramPayments,
  useBatchUpdateMemberProgramPayments,
} from '@/lib/hooks/use-member-program-payments';
import { useMemberProgramFinances } from '@/lib/hooks/use-member-program-finances';
import { useMemberProgramItems } from '@/lib/hooks/use-member-program-items';
import { useFinancialsDerived } from '@/lib/hooks/use-financials-derived';
import { useProgramStatus } from '@/lib/hooks/use-program-status';
import { formatCurrency } from '@/lib/utils/money';

interface MemberProgramPaymentFormProps {
  programId: number;
  initialValues?: Partial<MemberProgramPaymentsFormData> & {
    member_program_payment_id?: number;
  };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  programStatus?: string; // Add program status prop
}

export default function MemberProgramPaymentForm({
  programId,
  initialValues,
  onSuccess,
  mode = 'create',
  programStatus,
}: MemberProgramPaymentFormProps) {
  const isEdit = mode === 'edit';

  // Fetch data needed for auto-adjustment logic
  const { data: allPayments = [] } = useMemberProgramPayments(programId);
  const { data: finances } = useMemberProgramFinances(programId);
  const { data: programItems = [] } = useMemberProgramItems(programId);
  const { data: statuses = [] } = useProgramStatus();

  // Calculate program price using the same logic as financials tab
  const totalTaxableCharge = React.useMemo(() => {
    return (programItems || []).reduce((sum: number, item: any) => {
      const quantity = item.quantity || 1;
      const charge = item.item_charge || 0;
      const isTaxable = item.therapies?.taxable === true;
      
      if (isTaxable) {
        return sum + (charge * quantity);
      }
      return sum;
    }, 0);
  }, [programItems]);

  // Use the final_total_price from finances if available, otherwise calculate it
  const programPrice = finances?.final_total_price || 0;

  // Check if program status allows payment amount editing AND payment is not already paid
  const statusName = programStatus?.toLowerCase() || '';
  const isPaymentPaid = initialValues?.payment_date && initialValues.payment_date.trim() !== '';
  const canEditAmount = (statusName === 'quote' || statusName === 'active') && !isPaymentPaid;

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
    resolver: zodResolver(memberProgramPaymentsFormSchema),
    defaultValues: {
      member_program_id: programId,
      payment_amount: 0,
      payment_due_date:
        normalizeDateInput((initialValues as any)?.payment_due_date) || '',
      payment_date:
        normalizeDateInput((initialValues as any)?.payment_date) || undefined,
      payment_status_id: (normalizedInitials as any)?.payment_status_id || 0,
      payment_method_id: (normalizedInitials as any)?.payment_method_id || 0,
      payment_reference: '',
      notes: '',
      ...(normalizedInitials as any),
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
      payment_status_id: (normalizedInitials as any)?.payment_status_id || 0,
      payment_method_id: (normalizedInitials as any)?.payment_method_id || 0,
      payment_reference: (normalizedInitials as any)?.payment_reference || '',
      notes: (normalizedInitials as any)?.notes || '',
    });
  }, [normalizedInitials, programId, reset]);

  const { data: statusOptions = [] } = useActivePaymentStatus();
  const { data: methodOptions = [] } = useActivePaymentMethods();

  const createPayment = useCreateMemberProgramPayment(programId);
  const updatePayment = useUpdateMemberProgramPayment(programId);
  const batchUpdatePayments = useBatchUpdateMemberProgramPayments();

  const watchedStatusId = watch('payment_status_id');
  const watchedAmount = watch('payment_amount');
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

  // Auto-adjustment logic and preview
  const autoAdjustmentPreview = React.useMemo(() => {
    if (!isEdit || !canEditAmount || !initialValues?.member_program_payment_id) {
      return null;
    }

    const currentAmount = initialValues.payment_amount || 0;
    const newAmount = watchedAmount || 0;
    const adjustment = newAmount - currentAmount;


    if (Math.abs(adjustment) < 0.01) {
      return null; // No significant change
    }

    // Find all unpaid payments except the current one
    const unpaidPayments = allPayments.filter(p => 
      p.member_program_payment_id !== initialValues.member_program_payment_id && 
      !p.payment_date
    );


    if (unpaidPayments.length === 0) {
      return {
        error: 'No unpaid payments available to adjust',
        canSave: false
      };
    }

    // Calculate paid total for proper adjustment calculation
    const paidPayments = allPayments.filter(p => p.payment_date && p.payment_date.trim() !== '');
    const paidTotal = paidPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);

    // Calculate how much each unpaid payment needs to be adjusted
    // Use proper rounding to avoid floating-point precision issues
    const adjustmentPerPayment = -adjustment / unpaidPayments.length;
    const adjustedPayments = unpaidPayments.map((payment, index) => {
      let adjustedAmount = (payment.payment_amount || 0) + adjustmentPerPayment;
      
      // Round to 2 decimal places for all but the last payment
      // The last payment gets any remaining adjustment to ensure exact total
      if (index < unpaidPayments.length - 1) {
        adjustedAmount = Math.round(adjustedAmount * 100) / 100;
      }
      
      return {
        ...payment,
        newAmount: Math.max(0, adjustedAmount)
      };
    });

    // Ensure the last payment accounts for any rounding differences
    if (adjustedPayments.length > 0) {
      const lastIndex = adjustedPayments.length - 1;
      
      // Calculate what the total should be with all payments except the last one
      const totalWithoutLastPayment = paidTotal + newAmount + 
        adjustedPayments.slice(0, -1).reduce((sum, p) => sum + p.newAmount, 0);
      
      // The last payment should be whatever amount makes the total equal to program price
      const lastPaymentAmount = programPrice - totalWithoutLastPayment;
      
      adjustedPayments[lastIndex]!.newAmount = Math.max(0, lastPaymentAmount);
    }

    // Check if any payment would go negative
    const hasNegativePayments = adjustedPayments.some(p => p.newAmount < 0);
    
    if (hasNegativePayments) {
      return {
        error: `Cannot adjust payment. This would require reducing remaining payments by $${Math.abs(adjustment).toFixed(2)}, but only $${unpaidPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0).toFixed(2)} is available.`,
        canSave: false
      };
    }

    // Calculate new total after auto-adjustments
    // Calculate adjusted total: paid payments (unchanged) + new amount + adjusted unpaid payments
    const adjustedTotal = paidTotal + newAmount + adjustedPayments.reduce((sum, p) => sum + p.newAmount, 0);


    const result = {
      adjustment,
      adjustedPayments,
      newTotal: adjustedTotal,
      programPrice,
      canSave: Math.abs(adjustedTotal - programPrice) < 0.01,
      error: Math.abs(adjustedTotal - programPrice) >= 0.01 ? `Total payments (${formatCurrency(adjustedTotal)}) must equal Program Price (${formatCurrency(programPrice)})` : null
    };

    return result;
  }, [isEdit, canEditAmount, initialValues, watchedAmount, allPayments, programPrice]);

  const onSubmit = async (values: MemberProgramPaymentsFormData) => {
    // Validate that status and method are selected (not 0)
    if (!values.payment_status_id || values.payment_status_id === 0) {
      setError('payment_status_id', {
        type: 'required',
        message: 'Status is required',
      });
      return;
    }

    if (!values.payment_method_id || values.payment_method_id === 0) {
      setError('payment_method_id', {
        type: 'required',
        message: 'Method is required',
      });
      return;
    }

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

    // Validate auto-adjustment if editing amount
    if (isEdit && canEditAmount && autoAdjustmentPreview) {
      if (!autoAdjustmentPreview.canSave) {
        setError('payment_amount', {
          type: 'validation',
          message: autoAdjustmentPreview.error || 'Cannot save with current payment amounts',
        });
        return;
      }
    }

    const payload: MemberProgramPaymentsFormData = {
      ...values,
      // Ensure paid date is null unless status is Paid
      payment_date: isPaid ? values.payment_date || null : null,
    };

    if (isEdit && initialValues?.member_program_payment_id) {
      // If we have auto-adjustments to make, we need to update multiple payments
      if (autoAdjustmentPreview && 'adjustedPayments' in autoAdjustmentPreview && autoAdjustmentPreview.adjustedPayments) {
        // Prepare batch update with all payment changes
        const paymentUpdates = [
          {
            ...payload,
            member_program_payment_id: initialValues.member_program_payment_id,
          },
          ...autoAdjustmentPreview.adjustedPayments.map(payment => ({
            member_program_payment_id: payment.member_program_payment_id,
            member_program_id: programId,
            payment_amount: payment.newAmount,
          }))
        ];
        
        await batchUpdatePayments.mutateAsync({
          programId,
          paymentUpdates,
        });
      } else {
        await updatePayment.mutateAsync({
          id: initialValues.member_program_payment_id,
          ...payload,
        });
      }
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
        isSubmitting || createPayment.isPending || updatePayment.isPending || batchUpdatePayments.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <Grid size={12}>
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
            disabled={!canEditAmount}
            {...register('payment_amount', { valueAsNumber: true })}
            error={!!errors.payment_amount}
            helperText={errors.payment_amount?.toString() || (canEditAmount ? 'Amount can be edited. Other payments will be auto-adjusted.' : (isPaymentPaid ? 'Amount cannot be edited for paid payments.' : 'Amount cannot be edited in current program status.'))}
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
                value={field.value || 0}
                onChange={e => {
                  clearErrors('payment_date');
                  const value = e.target.value;
                  field.onChange(value ? Number(value) : 0);
                }}
              >
                <MenuItem value={0}>
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
                  value={field.value || 0}
                  onChange={e => {
                    const value = e.target.value;
                    field.onChange(value ? Number(value) : 0);
                  }}
                >
                  <MenuItem value={0}>
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

      {/* Auto-adjustment preview */}
      {autoAdjustmentPreview && (
        <Grid size={12}>
          <Box sx={{ mt: 2 }}>
            {autoAdjustmentPreview.error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {autoAdjustmentPreview.error}
              </Alert>
            ) : (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Payment Adjustment Preview
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Program Price:</strong> {formatCurrency(programPrice)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>New Total:</strong> {formatCurrency((autoAdjustmentPreview as any).newTotal || 0)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Adjustment:</strong> {((autoAdjustmentPreview as any).adjustment || 0) > 0 ? '+' : ''}{formatCurrency((autoAdjustmentPreview as any).adjustment || 0)}
                  </Typography>
                </Alert>
                
                <Typography variant="subtitle2" gutterBottom>
                  Other payments will be adjusted as follows:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {((autoAdjustmentPreview as any).adjustedPayments || []).map((payment: any, index: number) => (
                    <Chip
                      key={payment.member_program_payment_id}
                      label={`Payment ${index + 1}: ${formatCurrency(payment.payment_amount || 0)} → ${formatCurrency(payment.newAmount)}`}
                      color={payment.newAmount === 0 ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Grid>
      )}
    </BaseForm>
  );
}
