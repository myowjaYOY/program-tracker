'use client';

import React from 'react';
import {
  TextField,
  MenuItem,
  Typography,
  Paper,
  Grid,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  memberProgramItemSchema,
  MemberProgramItemFormData,
} from '@/lib/validations/member-program-item';
import { Therapies } from '@/types/database.types';
import { useTherapyTypes } from '@/lib/hooks/use-therapy-types';
import { BaseForm } from '@/components/forms/base-form';

interface AddProgramItemFormProps {
  therapies: Therapies[];
  onSave: (data: MemberProgramItemFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<MemberProgramItemFormData>;
  mode?: 'create' | 'edit';
}

export default function AddProgramItemForm({
  therapies,
  onSave,
  onCancel: _onCancel,
  initialValues,
  mode = 'create',
}: AddProgramItemFormProps) {
  const { data: therapyTypes = [] } = useTherapyTypes();
  const usedCount = Number((initialValues as any)?.used_count || 0);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MemberProgramItemFormData>({
    resolver: zodResolver(memberProgramItemSchema),
    defaultValues: {
      therapy_type_id: initialValues?.therapy_type_id || 0,
      therapy_id: initialValues?.therapy_id || 0,
      quantity: initialValues?.quantity || 1,
      days_from_start: initialValues?.days_from_start || 0,
      days_between: initialValues?.days_between || 0,
      instructions: initialValues?.instructions || '',
    },
  });

  const selectedTherapyTypeId = watch('therapy_type_id');
  const selectedTherapyId = watch('therapy_id');
  const quantity = watch('quantity');
  const daysBetween = watch('days_between');
  const daysFromStart = watch('days_from_start');

  // Special Calculator state
  const [isSpecialCalculatorOpen, setIsSpecialCalculatorOpen] = React.useState(false);
  const [calculatorData, setCalculatorData] = React.useState({
    count: '',
    quantity: '',
    prescription: ''
  });

  // Calculate duration helper text
  const calculateDuration = (quantity: number, daysBetween: number, daysFromStart: number): string => {
    if (quantity === 0 || (quantity === 1 && daysBetween === 0 && daysFromStart === 0)) return '';
    
    // For single occurrence (quantity = 1), only consider daysFromStart
    // For multiple occurrences, calculate total span
    const totalDays = quantity === 1 
      ? daysFromStart 
      : (quantity - 1) * daysBetween + daysFromStart;
    
    const months = Math.floor(totalDays / 30);
    const remainingAfterMonths = totalDays % 30;
    const weeks = Math.round(remainingAfterMonths / 7);
    
    const parts = [];
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (weeks > 0) parts.push(`${weeks} week${weeks !== 1 ? 's' : ''}`);
    
    return parts.length > 0 ? `Duration: ${parts.join(', ')}` : '';
  };

  // Calculate duration for initial values to show on dialog load
  const initialDuration = calculateDuration(
    initialValues?.quantity || 1,
    initialValues?.days_between || 0,
    initialValues?.days_from_start || 0
  );


  // Reset form when initialValues change (for edit mode)
  React.useEffect(() => {
    if (initialValues && mode === 'edit') {
      reset({
        therapy_type_id: initialValues.therapy_type_id || 0,
        therapy_id: initialValues.therapy_id || 0,
        quantity: initialValues.quantity || 1,
        days_from_start: initialValues.days_from_start || 0,
        days_between: initialValues.days_between || 0,
        instructions: initialValues.instructions || '',
      });
    }
  }, [initialValues, mode, reset]);

  // Filter therapies based on selected therapy type
  const filteredTherapies = selectedTherapyTypeId
    ? therapies.filter(
        t => t.therapy_type_id === selectedTherapyTypeId && t.active_flag
      )
    : [];

  const selectedTherapy = therapies.find(
    t => t.therapy_id === selectedTherapyId
  );

  // Reset therapy selection when therapy type changes
  const handleTherapyTypeChange = (_therapyTypeId: number) => {
    setValue('therapy_id', 0);
  };

  const onSubmit = (data: MemberProgramItemFormData) => {
    // Remove therapy_type_id from the data sent to the API since it's not stored in member_program_items
    const { therapy_type_id, ...apiData } = data;
    onSave(apiData as MemberProgramItemFormData);
  };

  const handleCalculatorOpen = () => {
    setIsSpecialCalculatorOpen(true);
  };

  const handleCalculatorClose = () => {
    setIsSpecialCalculatorOpen(false);
    setCalculatorData({ count: '', quantity: '', prescription: '' });
  };

  const handleCalculatorChange = (field: string, value: string) => {
    setCalculatorData(prev => ({ ...prev, [field]: value }));
  };

  // Calculate duration for Special Calculator
  const calculateSpecialDuration = (count: string, quantity: string, prescription: string): string => {
    const countNum = parseInt(count) || 0;
    const quantityNum = parseInt(quantity) || 0;
    const prescriptionNum = parseInt(prescription) || 0;
    
    if (countNum === 0 || quantityNum === 0 || prescriptionNum === 0) {
      return '';
    }
    
    const totalDays = Math.floor((countNum * quantityNum) / prescriptionNum);
    
    const months = Math.floor(totalDays / 30);
    const remainingAfterMonths = totalDays % 30;
    const weeks = Math.round(remainingAfterMonths / 7);
    
    const parts = [];
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (weeks > 0) parts.push(`${weeks} week${weeks !== 1 ? 's' : ''}`);
    
    return parts.length > 0 ? `Duration: ${parts.join(', ')}` : '';
  };

  return (
    <BaseForm
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      submitText={
        isSubmitting
          ? mode === 'edit'
            ? 'Updating...'
            : 'Adding...'
          : mode === 'edit'
            ? 'Update'
            : 'Create'
      }
      submitHandler={handleSubmit(onSubmit)}
      buttonContainerSx={{ width: 615, justifyContent: 'flex-end' }}
    >
      <Grid size={{ xs: 12, md: 6 }}>
        <Controller
          name="therapy_type_id"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Therapy Type"
              fullWidth
              required
              error={!!errors.therapy_type_id}
              helperText={errors.therapy_type_id?.message}
              sx={{ minWidth: 300, maxWidth: 300 }}
              disabled={mode === 'edit'}
              onChange={e => {
                const value = Number(e.target.value);
                field.onChange(value);
                handleTherapyTypeChange(value);
              }}
            >
              <MenuItem value={0}>Select a therapy type...</MenuItem>
              {therapyTypes
                .filter(t => t.active_flag)
                .sort((a, b) =>
                  a.therapy_type_name.localeCompare(b.therapy_type_name)
                )
                .map(therapyType => (
                  <MenuItem
                    key={therapyType.therapy_type_id}
                    value={therapyType.therapy_type_id}
                  >
                    {therapyType.therapy_type_name}
                  </MenuItem>
                ))}
            </TextField>
          )}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Controller
          name="therapy_id"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Therapy"
              fullWidth
              required
              disabled={mode === 'edit' || !selectedTherapyTypeId}
              error={!!errors.therapy_id}
              helperText={errors.therapy_id?.message}
              sx={{ minWidth: 300, maxWidth: 300 }}
            >
              <MenuItem value={0}>Select a therapy...</MenuItem>
              {filteredTherapies
                .sort((a, b) => a.therapy_name.localeCompare(b.therapy_name))
                .map(therapy => (
                  <MenuItem key={therapy.therapy_id} value={therapy.therapy_id}>
                    {therapy.therapy_name}
                  </MenuItem>
                ))}
            </TextField>
          )}
        />
      </Grid>

      <Grid size={12}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box sx={{ width: '31%' }}>
            <Controller
              name="quantity"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Quantity"
                  type="number"
                  fullWidth
                  required
                  disabled={mode === 'create' && !selectedTherapyId}
                  inputProps={{ min: Math.max(1, usedCount) }}
                  error={
                    !!errors.quantity ||
                    (mode === 'edit' && quantity < usedCount)
                  }
                  helperText={
                    errors.quantity?.message ||
                    (mode === 'edit' && quantity < usedCount
                      ? `Minimum is ${usedCount} (used)`
                      : undefined) ||
                    calculateDuration(quantity, daysBetween, daysFromStart) ||
                    initialDuration ||
                    (usedCount > 0 ? `${usedCount} used` : undefined)
                  }
                  onChange={e => field.onChange(Number(e.target.value))}
                />
              )}
            />
          </Box>
          <Box sx={{ width: '31%' }}>
            <Controller
              name="days_from_start"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Days From Start"
                  type="number"
                  fullWidth
                  required
                  disabled={mode === 'create' && !selectedTherapyId}
                  inputProps={{ min: 0 }}
                  error={!!errors.days_from_start}
                  helperText={errors.days_from_start?.message}
                  onChange={e => field.onChange(Number(e.target.value))}
                />
              )}
            />
          </Box>
          <Box sx={{ width: '31%' }}>
            <Controller
              name="days_between"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Days Between (if recurring)"
                  type="number"
                  fullWidth
                  disabled={mode === 'create' && !selectedTherapyId}
                  inputProps={{ min: 0 }}
                  error={!!errors.days_between}
                  helperText={
                    errors.days_between?.message ||
                    'Leave as 0 for single occurrence'
                  }
                  onChange={e => field.onChange(Number(e.target.value))}
                />
              )}
            />
          </Box>
        </Box>
      </Grid>

      <Grid size={12}>
        <Controller
          name="instructions"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Instructions"
              multiline
              rows={3}
              disabled={!selectedTherapyId}
              error={!!errors.instructions}
              helperText={errors.instructions?.message}
              sx={{ width: 615 }}
            />
          )}
        />
      </Grid>

      <Grid size={12}>
        {/* Cost Summary - Always visible */}
        <Paper sx={{ p: 2, bgcolor: 'grey.50', width: 615 }}>
          <Grid container spacing={2}>
            <Grid size={2.4}>
              <Typography variant="body2" color="text.secondary">
                U Cost: ${(selectedTherapy?.cost || 0).toFixed(2)}
              </Typography>
              <Typography 
                variant="caption" 
                color="primary" 
                sx={{ opacity: 0.7, textDecoration: 'underline', cursor: 'pointer' }}
                onClick={handleCalculatorOpen}
              >
                Special Calculator
              </Typography>
            </Grid>
            <Grid size={2.4}>
              <Typography variant="body2" color="text.secondary">
                U Chrg: ${(selectedTherapy?.charge || 0).toFixed(2)}
              </Typography>
            </Grid>
            <Grid size={2.4}>
              <Typography variant="body2" color="text.secondary">
                T Cost: $
                {((selectedTherapy?.cost || 0) * quantity).toFixed(2)}
              </Typography>
            </Grid>
            <Grid size={2.4}>
              <Typography variant="body2" color="text.secondary">
                T Chrg: $
                {((selectedTherapy?.charge || 0) * quantity).toFixed(2)}
              </Typography>
            </Grid>
            <Grid size={2.4}>
              <Typography variant="body2" color="text.secondary">
                Margin:{' '}
                {(selectedTherapy?.charge || 0) > 0
                  ? Math.floor(
                      (((selectedTherapy?.charge || 0) -
                        (selectedTherapy?.cost || 0)) /
                        (selectedTherapy?.charge || 0)) *
                      100
                    )
                  : 0}
                %
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      {/* Special Calculator Modal */}
      <Dialog open={isSpecialCalculatorOpen} onClose={handleCalculatorClose} maxWidth="sm" fullWidth>
        <DialogTitle>Special Calculator</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This calculator will tell you how long it will take to consume this item given how many of this item you have (Count), how many are in each (Quantity) and how many per day will be used (Prescription)
          </Typography>
          
          <Grid container spacing={2}>
            <Grid size={4}>
              <TextField
                label="Count"
                type="number"
                fullWidth
                value={calculatorData.count}
                onChange={(e) => handleCalculatorChange('count', e.target.value)}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="Quantity"
                type="number"
                fullWidth
                value={calculatorData.quantity}
                onChange={(e) => handleCalculatorChange('quantity', e.target.value)}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="Prescription"
                type="number"
                fullWidth
                value={calculatorData.prescription}
                onChange={(e) => handleCalculatorChange('prescription', e.target.value)}
                inputProps={{ min: 1 }}
              />
            </Grid>
          </Grid>
          
          {/* Duration Result */}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="primary">
              {calculateSpecialDuration(calculatorData.count, calculatorData.quantity, calculatorData.prescription)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCalculatorClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </BaseForm>
  );
}
