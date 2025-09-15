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
  Alert
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { MemberPrograms } from '@/types/database.types';
import { memberProgramFinancesSchema, MemberProgramFinancesFormData } from '@/lib/validations/member-program-finances';
import { useMemberProgramFinances, useCreateMemberProgramFinances, useUpdateMemberProgramFinances } from '@/lib/hooks/use-member-program-finances';
import { useActiveFinancingTypes } from '@/lib/hooks/use-financing-types';


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
  // Fetch existing finances data
  const { data: existingFinances, isLoading: isLoadingFinances, error: financesError } = useMemberProgramFinances(program.member_program_id);
  
  // Fetch financing types for dropdown
  const { data: financingTypes = [], isLoading: isLoadingFinancingTypes } = useActiveFinancingTypes();
  
  // Mutations
  const createFinances = useCreateMemberProgramFinances();
  const updateFinances = useUpdateMemberProgramFinances();
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    setValue,
    reset,
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

  // Local display states for currency inputs to allow free typing
  const [discountsInput, setDiscountsInput] = React.useState<string>('$0.00');
  const [financeChargesInput, setFinanceChargesInput] = React.useState<string>('$0.00');
  const [taxesInput, setTaxesInput] = React.useState<string>('$0.00');

  const formatCurrency = (n: number): string => `$${Number(n || 0).toFixed(2)}`;
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
      setDiscountsInput(formatCurrency(existingFinances.discounts || 0));
      setFinanceChargesInput(formatCurrency(existingFinances.finance_charges || 0));
      setTaxesInput(formatCurrency(existingFinances.taxes || 0));
    }
    // Reset unsaved flag when (re)loading data for this program
    onUnsavedChangesChange?.(false);
  }, [existingFinances, program.member_program_id, reset]);
  
  // Calculate final total price and margin (use Final Total Price)
  React.useEffect(() => {
    const totalCost = program.total_cost || 0;
    const totalCharge = program.total_charge || 0;
    const financeCharges = watchedValues.finance_charges || 0;
    const taxes = watchedValues.taxes || 0;
    const discounts = watchedValues.discounts || 0;
    
    const finalTotal = totalCharge + financeCharges + discounts;
    const margin = finalTotal > 0 ? ((finalTotal - totalCost) / finalTotal) * 100 : 0;
    
    const currentFinal = getValues('final_total_price');
    const currentMargin = getValues('margin');
    const baseInputsDirty = !!(dirtyFields.finance_charges || dirtyFields.discounts || dirtyFields.taxes);
    const markDirty = hasInitializedDerived.current && baseInputsDirty;
    if (currentFinal !== finalTotal) {
      setValue('final_total_price', finalTotal, { shouldDirty: markDirty });
    }
    if (currentMargin !== margin) {
      setValue('margin', margin, { shouldDirty: markDirty });
    }
    if (!hasInitializedDerived.current) {
      hasInitializedDerived.current = true;
    }
  }, [program.total_cost, program.total_charge, watchedValues.finance_charges, watchedValues.taxes, watchedValues.discounts, setValue, dirtyFields.finance_charges, dirtyFields.discounts, dirtyFields.taxes]);

  const onSubmit = async (data: MemberProgramFinancesFormData) => {
    try {
      const toastId = toast.loading('Saving...');
      if (existingFinances) {
        // Update existing record
        await updateFinances.mutateAsync({
          programId: program.member_program_id,
          data: {
            finance_charges: data.finance_charges,
            taxes: data.taxes,
            discounts: data.discounts,
            final_total_price: data.final_total_price,
            margin: data.margin,
            financing_type_id: data.financing_type_id,
          }
        });
        toast.success('Program finances updated successfully', { id: toastId });
      } else {
        // Create new record
        await createFinances.mutateAsync({
          programId: program.member_program_id,
          data
        });
        toast.success('Program finances created successfully', { id: toastId });
      }
      onFinancesUpdate?.(data);
      onUnsavedChangesChange?.(false);
    } catch (error) {
      console.error('Error saving program finances:', error);
      toast.error('Failed to save program finances');
    }
  };

  // Track form dirty state and notify parent (for navigation guard)
  React.useEffect(() => {
    onUnsavedChangesChange?.(isDirty);
  }, [isDirty, onUnsavedChangesChange]);

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
          <Grid container spacing={3}>
            {/* Row 1: Total Cost, Total Charge, Margin */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Total Cost"
                fullWidth
                disabled
                value={`$${Number(program.total_cost || 0).toFixed(2)}`}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Total Charge"
                fullWidth
                disabled
                value={`$${Number(program.total_charge || 0).toFixed(2)}`}
                InputProps={{ readOnly: true }}
                helperText="Does Not Include Finance Charges or Discounts"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                {...register('margin', { valueAsNumber: true })}
                label="Margin (%)"
                fullWidth
                disabled
                value={`${Number(watchedValues.margin || 0).toFixed(1)}%`}
                InputProps={{ readOnly: true }}
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
                      disabled={isLoadingFinancingTypes}
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
                  <TextField
                    label="Finance Charges"
                    fullWidth
                    error={!!errors.finance_charges}
                    helperText={errors.finance_charges?.message || 'Positive or negative based on financing type.'}
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
                        setFinanceChargesInput(formatCurrency(converted));
                      } else {
                        setFinanceChargesInput(formatCurrency(field.value || 0));
                      }
                    }}
                    disabled={!financingTypeSelected}
                  />
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
                        setDiscountsInput(formatCurrency(converted));
                      } else {
                        field.onChange(-Math.abs(Number(field.value || 0)));
                        setDiscountsInput(formatCurrency(-Math.abs(Number(field.value || 0))));
                      }
                    }}
                  />
                )}
              />
            </Grid>

            {/* Row 3: Final Total Price and Taxes */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                {...register('final_total_price', { valueAsNumber: true })}
                label="Program Price"
                fullWidth
                disabled
                value={`$${Number(watchedValues.final_total_price || 0).toFixed(2)}`}
                InputProps={{ readOnly: true }}
                helperText="Does Not Include Taxes"
              />
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
                    onBlur={() => setTaxesInput(formatCurrency(field.value || 0))}
                  />
                )}
              />
            </Grid>
          </Grid>
          
          {/* Save Button */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!isDirty || isLoading || isSaving}
              startIcon={isSaving ? <CircularProgress size={16} /> : null}
              sx={{ borderRadius: 0, fontWeight: 600 }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
