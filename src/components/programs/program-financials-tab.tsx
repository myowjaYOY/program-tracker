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
  Divider,
  Card,
  CardContent,
  CardHeader,
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
}

export default function ProgramFinancialsTab({ 
  program, 
  onFinancesUpdate 
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
    setValue,
    reset,
    formState: { errors, isDirty }
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
    }
  }, [existingFinances, program.member_program_id, reset]);
  
  // Calculate final total price and margin
  React.useEffect(() => {
    const totalCost = program.total_cost || 0;
    const totalCharge = program.total_charge || 0;
    const financeCharges = watchedValues.finance_charges || 0;
    const taxes = watchedValues.taxes || 0;
    const discounts = watchedValues.discounts || 0;
    
    const finalTotal = totalCharge + financeCharges - discounts;
    const margin = totalCost > 0 ? ((finalTotal - totalCost) / totalCost) * 100 : 0;
    
    setValue('final_total_price', finalTotal);
    setValue('margin', margin);
  }, [program.total_cost, program.total_charge, watchedValues.finance_charges, watchedValues.taxes, watchedValues.discounts, setValue]);

  const onSubmit = async (data: MemberProgramFinancesFormData) => {
    try {
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
        toast.success('Program finances updated successfully');
      } else {
        // Create new record
        await createFinances.mutateAsync({
          programId: program.member_program_id,
          data
        });
        toast.success('Program finances created successfully');
      }
      onFinancesUpdate?.(data);
    } catch (error) {
      console.error('Error saving program finances:', error);
      toast.error('Failed to save program finances');
    }
  };

  const isLoading = isLoadingFinances || createFinances.isPending || updateFinances.isPending;

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
        <CardHeader 
          title="Program Financials" 
          subheader="Manage program pricing, charges, and financing details"
        />
        <CardContent>
          <Grid container spacing={3}>
            {/* Total Cost (Display Only) */}
            <Grid item xs={12} md={6}>
              <TextField
                label="Total Cost"
                type="number"
                fullWidth
                disabled
                value={program.total_cost || 0}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                }}
                helperText="From program template"
              />
            </Grid>

            {/* Total Charge (Display Only) */}
            <Grid item xs={12} md={6}>
              <TextField
                label="Total Charge"
                type="number"
                fullWidth
                disabled
                value={program.total_charge || 0}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                }}
                helperText="From program template"
              />
            </Grid>

            {/* Finance Charges */}
            <Grid item xs={12} md={6}>
              <TextField
                {...register('finance_charges', { valueAsNumber: true })}
                label="Finance Charges"
                type="number"
                fullWidth
                error={!!errors.finance_charges}
                helperText={errors.finance_charges?.message}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                }}
              />
            </Grid>

            {/* Taxes */}
            <Grid item xs={12} md={6}>
              <TextField
                {...register('taxes', { valueAsNumber: true })}
                label="Taxes"
                type="number"
                fullWidth
                error={!!errors.taxes}
                helperText={errors.taxes?.message}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                }}
              />
            </Grid>

            {/* Discounts */}
            <Grid item xs={12} md={6}>
              <TextField
                {...register('discounts', { valueAsNumber: true })}
                label="Discounts"
                type="number"
                fullWidth
                error={!!errors.discounts}
                helperText={errors.discounts?.message}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Calculated Fields */}
            <Grid item xs={12} md={6}>
              <TextField
                {...register('final_total_price', { valueAsNumber: true })}
                label="Final Total Price"
                type="number"
                fullWidth
                disabled
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                }}
                helperText="Calculated automatically"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                {...register('margin', { valueAsNumber: true })}
                label="Margin (%)"
                type="number"
                fullWidth
                disabled
                InputProps={{
                  endAdornment: <Typography sx={{ ml: 1 }}>%</Typography>
                }}
                helperText="Calculated automatically"
              />
            </Grid>

            {/* Financing Type */}
            <Grid item xs={12} md={6}>
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

          </Grid>
          
          {/* Save Button */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={!isDirty || isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
            >
              {isLoading ? 'Saving...' : existingFinances ? 'Update Finances' : 'Save Finances'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
