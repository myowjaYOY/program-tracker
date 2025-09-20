'use client';

import React from 'react';
import {
  Box,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { formatCurrency } from '@/lib/utils/money';
import FormStatus from '@/components/ui/FormStatus';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// import { toast } from 'sonner';
import { MemberPrograms } from '@/types/database.types';
import { memberProgramFinancesSchema, MemberProgramFinancesFormData } from '@/lib/validations/member-program-finances';
import { useMemberProgramFinances, useCreateMemberProgramFinances, useUpdateMemberProgramFinances } from '@/lib/hooks/use-member-program-finances';
import { useMemberProgramPayments, useRegenerateMemberProgramPayments } from '@/lib/hooks/use-member-program-payments';
import { useActiveFinancingTypes } from '@/lib/hooks/use-financing-types';
import { useMemberProgram } from '@/lib/hooks/use-member-programs';
import { useProgramStatus } from '@/lib/hooks/use-program-status';
import { isProgramLocked } from '@/lib/utils/program-lock';
import useFinancialsLock from '@/lib/hooks/use-financials-lock';
import { useFinancialsDerived } from '@/lib/hooks/use-financials-derived';
import { shouldRegeneratePayments } from '@/lib/utils/payments-rules';


interface ProgramFinancialsTabProps {
  program: MemberPrograms;
  onFinancesUpdate?: (updatedFinances: MemberProgramFinancesFormData) => void;
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
}

export default function ProgramFinancialsTab({ 
  program, 
  onFinancesUpdate,
  onUnsavedChangesChange
}: ProgramFinancialsTabProps) {
  const theme = useTheme();
  // Fetch existing finances data
  const { data: existingFinances, isLoading: isLoadingFinances, error: financesError } = useMemberProgramFinances(program.member_program_id);
  
  // Fetch financing types for dropdown
  const { data: financingTypes = [], isLoading: isLoadingFinancingTypes } = useActiveFinancingTypes();
  
  // Mutations
  const createFinances = useCreateMemberProgramFinances();
  const updateFinances = useUpdateMemberProgramFinances();
  const regeneratePayments = useRegenerateMemberProgramPayments();
  const { data: payments = [] } = useMemberProgramPayments(program.member_program_id);
  const { data: freshProgram } = useMemberProgram(program.member_program_id);
  const { data: allStatuses = [] } = useProgramStatus();

  const paidTotal = React.useMemo(() => {
    return (payments || []).reduce((sum: number, p: any) => {
      const isPaid = !!p?.payment_date;
      const amt = Number(p?.payment_amount || 0);
      return isPaid ? sum + amt : sum;
    }, 0);
  }, [payments]);
  const hasPaidPayment = React.useMemo(() => (payments || []).some((p: any) => !!p?.payment_date), [payments]);
  const lock = useFinancialsLock(freshProgram || program, payments as any);
  const isLockedByStatus = lock.isLockedByStatus;
  const isLocked = lock.locked;
  const [baselineVersion, setBaselineVersion] = React.useState(0);
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    setValue,
    reset,
    trigger,
    formState: { errors, isDirty, dirtyFields }
  } = useForm<MemberProgramFinancesFormData>({
    resolver: zodResolver(memberProgramFinancesSchema),
    defaultValues: {
      member_program_id: program.member_program_id,
      finance_charges: 0,
      taxes: 0,
      discounts: 0,
      final_total_price: 0,
      margin: 0,
      financing_type_id: undefined,
    }
  });

  // Watch for changes to calculate totals
  const watchedValues = watch();
  const financingTypeSelected = watch('financing_type_id');

  // Margin color thresholds: green ≥80, orange ≥75 and <80, red <75
  const marginValue = Number(watchedValues.margin || 0);
  const marginColor = marginValue >= 80
    ? theme.palette.success.main
    : marginValue >= 75
    ? theme.palette.warning.main
    : theme.palette.error.main;
  const originalFinancingTypeIdRef = React.useRef<number | undefined>(undefined);
  const originalFinanceChargesRef = React.useRef<number>(0);
  const originalDiscountsRef = React.useRef<number>(0);
  const originalTaxesRef = React.useRef<number>(0);

  // Local display states for currency inputs to allow free typing
  const [discountsInput, setDiscountsInput] = React.useState<string>('$0.00');
  const [financeChargesInput, setFinanceChargesInput] = React.useState<string>('$0.00');
  const [taxesInput, setTaxesInput] = React.useState<string>('$0.00');

  const formatCurrencyInline = (n: number): string => `$${Number(n || 0).toFixed(2)}`;
  const roundToCents = (n: number): number => Math.round(n * 100) / 100;
  const sanitizeNumeric = (input: string): string => {
    let s = input.replace(/[^0-9.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    return s;
  };
  // Prevent initial derived setValue from marking form dirty
  const hasInitializedDerived = React.useRef(false);
  const sanitizeNumericAllowNegative = (input: string): string => {
    let s = input.replace(/[^0-9.\-]/g, '');
    // keep only leading '-'
    if (s.startsWith('-')) {
      s = '-' + s.slice(1).replace(/\-/g, '');
    } else {
      s = s.replace(/\-/g, '');
    }
    // keep only first '.'
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    return s;
  };
  const sanitizePercentTyping = (input: string, allowNegative: boolean): string => {
    let s = input.replace(allowNegative ? /[^0-9.%\-]/g : /[^0-9.%]/g, '');
    if (allowNegative) {
      if (s.startsWith('-')) s = '-' + s.slice(1).replace(/\-/g, '');
      else s = s.replace(/\-/g, '');
    } else {
      s = s.replace(/\-/g, '');
    }
    const hasPct = s.endsWith('%');
    const core = hasPct ? s.slice(0, -1) : s;
    const dot = core.indexOf('.');
    const cleaned = dot === -1 ? core : core.slice(0, dot + 1) + core.slice(dot + 1).replace(/\./g, '');
    return hasPct ? cleaned + '%' : cleaned;
  };
  const convertPercentStringToAmount = (raw: string, base: number, forceNegative: boolean): number | null => {
    if (!raw.trim().endsWith('%')) return null;
    const isNeg = raw.trim().startsWith('-');
    const v = parseFloat(raw.trim().replace('%', '').replace('+', ''));
    if (Number.isNaN(v)) return null;
    const pct = Math.min(Math.max(Math.abs(v), 0), 100);
    let amount = roundToCents(base * (pct / 100));
    if (forceNegative) amount = -Math.abs(amount);
    else amount = isNeg ? -amount : amount;
    return amount;
  };
  
  // Derived values via shared hook
  const { programPrice: derivedProgramPrice, margin: derivedMargin } = useFinancialsDerived({
    totalCharge: Number(program.total_charge || 0),
    totalCost: Number(program.total_cost || 0),
    financeCharges: Number(watchedValues.finance_charges || 0),
    discounts: Number(watchedValues.discounts || 0),
  });

  // Load existing data when available
  React.useEffect(() => {
    if (existingFinances) {
      reset({
        member_program_id: program.member_program_id,
        finance_charges: existingFinances.finance_charges || 0,
        taxes: existingFinances.taxes || 0,
        discounts: existingFinances.discounts || 0,
        final_total_price: existingFinances.final_total_price || 0,
        margin: existingFinances.margin || 0,
        financing_type_id: existingFinances.financing_type_id || undefined,
      });
      setDiscountsInput(formatCurrencyInline(existingFinances.discounts || 0));
      setFinanceChargesInput(formatCurrencyInline(existingFinances.finance_charges || 0));
      setTaxesInput(formatCurrencyInline(existingFinances.taxes || 0));
      originalFinancingTypeIdRef.current = existingFinances.financing_type_id || undefined;
      originalFinanceChargesRef.current = Number(existingFinances.finance_charges || 0);
      originalDiscountsRef.current = Number(existingFinances.discounts || 0);
      originalTaxesRef.current = Number(existingFinances.taxes || 0);
      // No local baseline; banner will compare against last-saved finances
    }
    // Reset unsaved flag when (re)loading data for this program
    onUnsavedChangesChange?.(false);
  }, [existingFinances, program.member_program_id, reset]);
  
  // Reflect derived values into form state as needed (without breaking dirtiness semantics)
  React.useEffect(() => {
    const currentFinal = getValues('final_total_price');
    const currentMargin = getValues('margin');
    const baseInputsDirty = !!(dirtyFields.finance_charges || dirtyFields.discounts || dirtyFields.taxes);
    const markDirty = hasInitializedDerived.current && baseInputsDirty;
    if (currentFinal !== derivedProgramPrice) {
      setValue('final_total_price', derivedProgramPrice, { shouldDirty: markDirty });
    }
    if (currentMargin !== derivedMargin) {
      setValue('margin', derivedMargin, { shouldDirty: markDirty });
    }
    if (!hasInitializedDerived.current) {
      hasInitializedDerived.current = true;
    }
  }, [derivedProgramPrice, derivedMargin, dirtyFields.finance_charges, dirtyFields.discounts, dirtyFields.taxes, getValues, setValue]);

  const [inline, setInline] = React.useState<{ ok: boolean; message: string } | null>(null);

  // Auto-hide success message after a short delay
  React.useEffect(() => {
    if (inline?.ok) {
      const t = setTimeout(() => setInline(null), 4000);
      return () => clearTimeout(t);
    }
  }, [inline]);

  const onSubmit = async (data: MemberProgramFinancesFormData) => {
    try {
      // Sanitize fields before sending to API (avoid '' for optional numbers)
      const safeFinancingTypeId =
        typeof (data as any).financing_type_id === 'number'
          ? (data as any).financing_type_id
          : undefined;

      const payload = {
        finance_charges: Number(data.finance_charges || 0),
        taxes: Number(data.taxes || 0),
        discounts: Number(data.discounts || 0),
        final_total_price: Number(data.final_total_price || 0),
        margin: Number(data.margin || 0),
        financing_type_id: safeFinancingTypeId,
      } as Partial<MemberProgramFinancesFormData>;
      setInline(null);
      if (existingFinances) {
        // Update existing record
        await updateFinances.mutateAsync({
          programId: program.member_program_id,
          data: payload
        });
      } else {
        // Create new record
        await createFinances.mutateAsync({
          programId: program.member_program_id,
          data: { ...(payload as any), member_program_id: program.member_program_id }
        });
      }
      // Unified payments update logic
      const paymentsExist = (payments?.length || 0) > 0;
      const shouldRegenerate = shouldRegeneratePayments({
        paymentsExist,
        originalFinancingTypeId: originalFinancingTypeIdRef.current ?? null,
        nextFinancingTypeId: (data.financing_type_id ?? null) as number | null,
        originalFinanceCharges: originalFinanceChargesRef.current,
        nextFinanceCharges: Number(data.finance_charges || 0),
        originalDiscounts: originalDiscountsRef.current,
        nextDiscounts: Number(data.discounts || 0),
      });
      if (shouldRegenerate) {
        try {
          await regeneratePayments.mutateAsync({ programId: program.member_program_id });
        } catch (e: any) {
          setInline({ ok: false, message: e?.message || 'Failed to update payments' });
          return;
        }
      } else {
        // no-op
      }
      // Update baselines after save (and potential regeneration)
      originalFinancingTypeIdRef.current = safeFinancingTypeId || undefined;
      originalFinanceChargesRef.current = Number(payload.finance_charges || 0);
      originalDiscountsRef.current = Number(payload.discounts || 0);
      originalTaxesRef.current = Number(payload.taxes || 0);
      setBaselineVersion(v => v + 1);

      onFinancesUpdate?.(data);
      onUnsavedChangesChange?.(false);
      setInline({ ok: true, message: 'Changes saved successfully' });
    } catch (error: any) {
      const msg = (error && (error.message || error.toString())) || 'Failed to save program finances';
      setInline({ ok: false, message: msg });
    }
  };

  // Compute and notify material changes (compare against latest baselines in refs)
  React.useEffect(() => {
    // Avoid false positives during load/save transitions
    if (isLoadingFinances || createFinances.isPending || updateFinances.isPending) {
      onUnsavedChangesChange?.(false);
      return;
    }

    const typeChanged = (originalFinancingTypeIdRef.current ?? null) !== (financingTypeSelected ?? null);
    const fcCurr = roundToCents(Number(watchedValues.finance_charges || 0));
    const fcBase = roundToCents(originalFinanceChargesRef.current);
    const discCurr = roundToCents(Number(watchedValues.discounts || 0));
    const discBase = roundToCents(originalDiscountsRef.current);
    const taxCurr = roundToCents(Number(watchedValues.taxes || 0));
    const taxBase = roundToCents(originalTaxesRef.current);

    const financeChargesChanged = fcBase !== fcCurr;
    const discountsChanged = discBase !== discCurr;
    const taxesChanged = taxBase !== taxCurr;

    const changed = typeChanged || financeChargesChanged || discountsChanged || taxesChanged;
    onUnsavedChangesChange?.(changed);
  }, [
    isLoadingFinances,
    createFinances.isPending,
    updateFinances.isPending,
    financingTypeSelected,
    watchedValues.finance_charges,
    watchedValues.discounts,
    watchedValues.taxes,
    baselineVersion,
    onUnsavedChangesChange,
  ]);

  // Local hasChanges for Save button state
  const hasChanges = React.useMemo(() => {
    const typeChanged = (originalFinancingTypeIdRef.current ?? null) !== (financingTypeSelected ?? null);
    const fcCurr = roundToCents(Number(watchedValues.finance_charges || 0));
    const fcBase = roundToCents(originalFinanceChargesRef.current);
    const discCurr = roundToCents(Number(watchedValues.discounts || 0));
    const discBase = roundToCents(originalDiscountsRef.current);
    const taxCurr = roundToCents(Number(watchedValues.taxes || 0));
    const taxBase = roundToCents(originalTaxesRef.current);
    return typeChanged || fcBase !== fcCurr || discBase !== discCurr || taxBase !== taxCurr;
  }, [financingTypeSelected, watchedValues.finance_charges, watchedValues.discounts, watchedValues.taxes, baselineVersion]);

  // Would the current edits require payments regeneration?
  const wouldRegenerate = React.useMemo(() => {
    const typeChanged = (originalFinancingTypeIdRef.current ?? null) !== (financingTypeSelected ?? null);
    const fcCurr = roundToCents(Number(watchedValues.finance_charges || 0));
    const fcBase = roundToCents(originalFinanceChargesRef.current);
    const discCurr = roundToCents(Number(watchedValues.discounts || 0));
    const discBase = roundToCents(originalDiscountsRef.current);
    return typeChanged || fcBase !== fcCurr || discBase !== discCurr;
  }, [financingTypeSelected, watchedValues.finance_charges, watchedValues.discounts, baselineVersion]);

  const isSaving = createFinances.isPending || updateFinances.isPending;
  const isLoading = isLoadingFinances;

  if (financesError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load program finances: {financesError.message}
      </Alert>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent>
          {isLocked && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Program must be in Quote status to change any information on this tab.
            </Alert>
          )}
          {/* Items/Program Price banner removed per simplified rules */}
          <Grid container spacing={3}>
            {/* Row 1: Total Cost, Total Charge, Margin */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField label="Total Cost" fullWidth disabled value={formatCurrency(Number(program.total_cost || 0))} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField label="Total Charge" fullWidth disabled value={formatCurrency(Number(program.total_charge || 0))} InputProps={{ readOnly: true }} helperText="Does Not Include Finance Charges or Discounts" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                {...register('margin', { valueAsNumber: true })}
                label="Margin (%)"
                fullWidth
                disabled
                value={`${Number(watchedValues.margin || 0).toFixed(1)}%`}
                InputProps={{ readOnly: true }}
                sx={{
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: marginColor,
                    color: marginColor,
                    fontWeight: 600,
                  },
                }}
              />
            </Grid>

            {/* Row 2: Financing Type, Discount, Finance Charges */}
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth error={!!errors.financing_type_id}>
                <InputLabel>Financing Type</InputLabel>
                <Controller
                  name="financing_type_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Financing Type"
                      value={field.value || ''}
                      disabled={isLoadingFinancingTypes || isLocked}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {financingTypes.map((type) => (
                        <MenuItem key={type.financing_type_id} value={type.financing_type_id}>
                          {type.financing_type_name}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {errors.financing_type_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {errors.financing_type_id.message}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Controller
                name="finance_charges"
                control={control}
                render={({ field }) => (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      label="Finance Charges"
                      fullWidth
                      error={!!errors.finance_charges}
                      helperText={
                        errors.finance_charges?.message ||
                        (Number(watchedValues.finance_charges || 0) > 0
                          ? 'Positive: Included in Program Price'
                          : Number(watchedValues.finance_charges || 0) < 0
                          ? 'Negative: Treated as Financing Fee (affects margin)'
                          : 'Enter amount or % (e.g., 5%)')
                      }
                      value={financeChargesInput}
                      onFocus={() => setFinanceChargesInput(String(field.value ?? ''))}
                      onChange={(e) => {
                        const raw = sanitizePercentTyping(e.target.value, true);
                        setFinanceChargesInput(raw);
                        if (!raw.endsWith('%')) {
                          const num = raw === '' || raw === '-' ? 0 : parseFloat(raw);
                          field.onChange(Number.isNaN(num) ? 0 : num);
                        }
                      }}
                      onBlur={() => {
                        const base = Number(program.total_charge || 0);
                        const converted = convertPercentStringToAmount(financeChargesInput, base, false);
                        if (converted !== null) {
                          field.onChange(converted);
                          setFinanceChargesInput(formatCurrencyInline(converted));
                        } else {
                          setFinanceChargesInput(formatCurrencyInline(field.value || 0));
                        }
                      }}
                      disabled={isLocked || !financingTypeSelected}
                    />
                    <Chip
                      label={
                        Number(watchedValues.finance_charges || 0) > 0
                          ? 'Included in Price'
                          : Number(watchedValues.finance_charges || 0) < 0
                          ? 'Affects Margin'
                          : '—'
                      }
                      color={
                        Number(watchedValues.finance_charges || 0) > 0
                          ? 'primary'
                          : Number(watchedValues.finance_charges || 0) < 0
                          ? 'warning'
                          : 'default'
                      }
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Controller
                name="discounts"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Discounts"
                    fullWidth
                    error={!!errors.discounts}
                    helperText={errors.discounts?.message}
                    value={discountsInput}
                    onFocus={() => setDiscountsInput(String(field.value ?? ''))}
                    onChange={(e) => {
                      const raw = sanitizePercentTyping(e.target.value, true);
                      setDiscountsInput(raw);
                      if (!raw.endsWith('%')) {
                        const num = raw === '' || raw === '-' ? 0 : parseFloat(raw);
                        field.onChange(Number.isNaN(num) ? 0 : -Math.abs(num));
                      }
                    }}
                    onBlur={() => {
                      const base = Number(program.total_charge || 0);
                      const converted = convertPercentStringToAmount(discountsInput, base, true);
                      if (converted !== null) {
                        field.onChange(converted);
                        setDiscountsInput(formatCurrencyInline(converted));
                      } else {
                        field.onChange(-Math.abs(Number(field.value || 0)));
                        setDiscountsInput(formatCurrencyInline(-Math.abs(Number(field.value || 0))));
                      }
                    }}
                    disabled={isLocked}
                  />
                )}
              />
            </Grid>

            {/* Row 3: Final Total Price and Taxes */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField {...register('final_total_price', { valueAsNumber: true })} label="Program Price" fullWidth disabled value={formatCurrency(Number(derivedProgramPrice || 0))} InputProps={{ readOnly: true }} helperText="Does Not Include Taxes" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Controller
                name="taxes"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Taxes"
                    fullWidth
                    error={!!errors.taxes}
                    helperText={errors.taxes?.message}
                    value={taxesInput}
                    onFocus={() => setTaxesInput(String(field.value ?? ''))}
                    onChange={(e) => {
                      const raw = sanitizeNumeric(e.target.value);
                      setTaxesInput(raw);
                      const num = raw === '' ? 0 : parseFloat(raw);
                      field.onChange(Number.isNaN(num) ? 0 : num);
                    }}
                    onBlur={() => setTaxesInput(formatCurrencyInline(field.value || 0))}
                    disabled={isLocked}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField label="Remaining Balance" fullWidth disabled value={formatCurrency(Number((derivedProgramPrice || 0) - paidTotal))} InputProps={{ readOnly: true }} helperText="Program Price minus total paid" />
            </Grid>
          </Grid>
          
          {/* Actions */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
            <FormStatus status={inline} onClose={() => setInline(null)} />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isLocked || !hasChanges || isLoading || isSaving}
              startIcon={isSaving ? <CircularProgress size={16} /> : null}
              sx={{ borderRadius: 0, fontWeight: 600 }}
            >
              {isSaving ? 'Saving...' : 'Save and Update Payments'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
