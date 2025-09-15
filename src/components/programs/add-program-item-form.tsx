'use client';

import React from 'react';
import { 
  TextField, 
  MenuItem,
  Typography,
  Paper,
  Grid,
  Box
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { memberProgramItemSchema, MemberProgramItemFormData } from '@/lib/validations/member-program-item';
import { Therapies, TherapyType } from '@/types/database.types';
import { useTherapyTypes } from '@/lib/hooks/use-therapy-types';
import { BaseForm } from '@/components/forms/base-form';

interface AddProgramItemFormProps {
  therapies: Therapies[];
  onSave: (data: MemberProgramItemFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<MemberProgramItemFormData>;
  mode?: 'create' | 'edit';
}

export default function AddProgramItemForm({ therapies, onSave, onCancel, initialValues, mode = 'create' }: AddProgramItemFormProps) {
  const { data: therapyTypes = [] } = useTherapyTypes();
  
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<MemberProgramItemFormData>({
    resolver: zodResolver(memberProgramItemSchema),
    defaultValues: {
      therapy_type_id: initialValues?.therapy_type_id || 0,
      therapy_id: initialValues?.therapy_id || 0,
      quantity: initialValues?.quantity || 1,
      days_from_start: initialValues?.days_from_start || 0,
      days_between: initialValues?.days_between || 0,
      instructions: initialValues?.instructions || '',
    }
  });

  const selectedTherapyTypeId = watch('therapy_type_id');
  const selectedTherapyId = watch('therapy_id');
  const quantity = watch('quantity');

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
    ? therapies.filter(t => t.therapy_type_id === selectedTherapyTypeId && t.active_flag)
    : [];
  
  const selectedTherapy = therapies.find(t => t.therapy_id === selectedTherapyId);

  // Reset therapy selection when therapy type changes
  const handleTherapyTypeChange = (therapyTypeId: number) => {
    setValue('therapy_id', 0);
  };

  const onSubmit = (data: MemberProgramItemFormData) => {
    // Remove therapy_type_id from the data sent to the API since it's not stored in member_program_items
    const { therapy_type_id, ...apiData } = data;
    onSave(apiData as MemberProgramItemFormData);
  };

  return (
    <BaseForm
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      submitText={isSubmitting ? (mode === 'edit' ? 'Updating...' : 'Adding...') : (mode === 'edit' ? 'Update' : 'Create')}
      submitHandler={handleSubmit(onSubmit)}
      buttonContainerSx={{ width: 615, justifyContent: 'flex-end' }}
    >
      <Grid item xs={12} md={6}>
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
              onChange={(e) => {
                const value = Number(e.target.value);
                field.onChange(value);
                handleTherapyTypeChange(value);
              }}
            >
              <MenuItem value={0}>Select a therapy type...</MenuItem>
              {therapyTypes
                .filter(t => t.active_flag)
                .sort((a, b) => a.therapy_type_name.localeCompare(b.therapy_type_name))
                .map((therapyType) => (
                  <MenuItem key={therapyType.therapy_type_id} value={therapyType.therapy_type_id}>
                    {therapyType.therapy_type_name}
                  </MenuItem>
                ))}
            </TextField>
          )}
        />
      </Grid>

      <Grid item xs={12} md={6}>
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
                .map((therapy) => (
                  <MenuItem key={therapy.therapy_id} value={therapy.therapy_id}>
                    {therapy.therapy_name}
                  </MenuItem>
                ))}
            </TextField>
          )}
        />
      </Grid>

      <Grid item xs={12}>
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
                  inputProps={{ min: 1 }}
                  error={!!errors.quantity}
                  helperText={errors.quantity?.message}
                  onChange={(e) => field.onChange(Number(e.target.value))}
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
                  onChange={(e) => field.onChange(Number(e.target.value))}
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
                  helperText={errors.days_between?.message || "Leave as 0 for single occurrence"}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              )}
            />
          </Box>
        </Box>
      </Grid>

      <Grid item xs={12}>
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

      <Grid item xs={12}>
        {/* Cost Summary - Always visible */}
        <Paper sx={{ p: 2, bgcolor: 'grey.50', width: 615 }}>
          <Typography variant="subtitle2" gutterBottom>
            Cost Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={2.4}>
              <Typography variant="body2" color="text.secondary">
                Unit Cost: ${selectedTherapy?.cost || 0}
              </Typography>
            </Grid>
            <Grid item xs={2.4}>
              <Typography variant="body2" color="text.secondary">
                Unit Chg: ${selectedTherapy?.charge || 0}
              </Typography>
            </Grid>
            <Grid item xs={2.4}>
              <Typography variant="body2" color="text.secondary">
                Tot Cost: ${((selectedTherapy?.cost || 0) * quantity).toFixed(2)}
              </Typography>
            </Grid>
            <Grid item xs={2.4}>
              <Typography variant="body2" color="text.secondary">
                Tot Chg: ${((selectedTherapy?.charge || 0) * quantity).toFixed(2)}
              </Typography>
            </Grid>
            <Grid item xs={2.4}>
              <Typography variant="body2" color="text.secondary">
                Margin %: {(selectedTherapy?.charge || 0) > 0 ? ((((selectedTherapy?.charge || 0) - (selectedTherapy?.cost || 0)) / (selectedTherapy?.charge || 0)) * 100).toFixed(1) : 0}%
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </BaseForm>
  );
}
