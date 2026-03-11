'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  Alert,
  IconButton,
  MenuItem,
  Select,
  InputLabel,
  Chip,
  OutlinedInput,
  Checkbox,
  ListItemText,
} from '@mui/material';
import BaseModal from '@/components/ui/base-modal';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { startCountSessionSchema, type StartCountSessionData } from '@/lib/validations/inventory-count';
import { useStartCountSession, useInventoryItems } from '@/lib/hooks/use-inventory-counts';
import { format } from 'date-fns';

interface StartCountModalProps {
  open: boolean;
  onClose: () => void;
}

export default function StartCountModal({ open, onClose }: StartCountModalProps) {
  const startMutation = useStartCountSession();
  const { data: inventoryItems = [], isLoading: itemsLoading } = useInventoryItems();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<StartCountSessionData>({
    resolver: zodResolver(startCountSessionSchema),
    defaultValues: {
      count_type: 'full',
      session_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      selected_item_ids: [],
    },
  });

  const countType = watch('count_type');

  // Sort inventory items alphabetically by therapy name
  const sortedInventoryItems = [...inventoryItems].sort((a, b) => 
    (a.therapy?.therapy_name || '').localeCompare(b.therapy?.therapy_name || '')
  );

  const onSubmit = async (data: StartCountSessionData) => {
    try {
      const submitData: any = {
        count_type: data.count_type,
        session_date: data.session_date,
      };
      if (data.notes) {
        submitData.notes = data.notes;
      }
      if (data.selected_item_ids) {
        submitData.selected_item_ids = data.selected_item_ids;
      }
      await startMutation.mutateAsync(submitData);
      reset();
      onClose();
    } catch (error) {
      // Error is handled by mutation hook
    }
  };

  const handleClose = () => {
    if (!startMutation.isPending) {
      reset();
      onClose();
    }
  };

  return (
    <BaseModal
      title="Start New Physical Count"
      subtitle="Create a new inventory count session"
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      dividers
      actions={
        <Button
          type="submit" // Need to trigger form from outside if actions are here, OR move form wrapping outside BaseModal
          variant="contained"
          disabled={startMutation.isPending}
          sx={{ borderRadius: 0, fontWeight: 600 }}
          onClick={handleSubmit(onSubmit)}
        >
          {startMutation.isPending ? 'Starting...' : 'Start Count Session'}
        </Button>
      }
    >
      <form id="start-count-form" onSubmit={handleSubmit(onSubmit)}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Count Type */}
            <FormControl component="fieldset" error={!!errors.count_type}>
              <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
                Count Type *
              </FormLabel>
              <Controller
                name="count_type"
                control={control}
                render={({ field }) => (
                  <RadioGroup {...field}>
                    <FormControlLabel
                      value="full"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Full Count
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Count all inventory items
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="cycle"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Cycle Count
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Count all items (same as full for now)
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="custom"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Custom Count
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Select specific items to count
                          </Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                )}
              />
              {errors.count_type && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.count_type.message}
                </Typography>
              )}
            </FormControl>

            {/* Session Date */}
            <Controller
              name="session_date"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Session Date"
                  type="date"
                  fullWidth
                  required
                  error={!!errors.session_date}
                  helperText={errors.session_date?.message}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              )}
            />

            {/* Custom Item Selection */}
            {countType === 'custom' && (
              <Controller
                name="selected_item_ids"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.selected_item_ids}>
                    <InputLabel id="custom-items-label">Select Items to Count *</InputLabel>
                    <Select
                      labelId="custom-items-label"
                      multiple
                      value={field.value || []}
                      onChange={field.onChange}
                      input={<OutlinedInput label="Select Items to Count *" />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as number[]).map((id) => {
                            const item = sortedInventoryItems.find((i) => i.inventory_item_id === id);
                            return (
                              <Chip
                                key={id}
                                label={item?.therapy?.therapy_name || `ID: ${id}`}
                                size="small"
                              />
                            );
                          })}
                        </Box>
                      )}
                      disabled={itemsLoading}
                    >
                      {sortedInventoryItems.map((item) => (
                        <MenuItem key={item.inventory_item_id} value={item.inventory_item_id}>
                          <Checkbox 
                            checked={(field.value || []).indexOf(item.inventory_item_id) > -1}
                          />
                          <ListItemText primary={item.therapy.therapy_name} />
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.selected_item_ids && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                        {errors.selected_item_ids.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            )}

            {/* Notes */}
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Notes"
                  multiline
                  rows={3}
                  fullWidth
                  placeholder="Optional notes about this count session..."
                  error={!!errors.notes}
                  helperText={errors.notes?.message}
                />
              )}
            />

            {/* Info Alert */}
            <Alert severity="info">
              {countType === 'custom'
                ? 'A new count session will be created with the selected items. You can then enter physical counts for each item.'
                : 'A new count session will be created with all active inventory items. You can then enter physical counts for each item.'}
            </Alert>
          </Box>
      </form>
    </BaseModal>
  );
}

