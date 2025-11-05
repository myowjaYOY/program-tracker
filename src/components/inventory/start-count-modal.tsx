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
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { startCountSessionSchema, type StartCountSessionData } from '@/lib/validations/inventory-count';
import { useStartCountSession } from '@/lib/hooks/use-inventory-counts';
import { format } from 'date-fns';

interface StartCountModalProps {
  open: boolean;
  onClose: () => void;
}

export default function StartCountModal({ open, onClose }: StartCountModalProps) {
  const startMutation = useStartCountSession();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<StartCountSessionData>({
    resolver: zodResolver(startCountSessionSchema),
    defaultValues: {
      count_type: 'full',
      session_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    },
  });

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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Start New Physical Count
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a new inventory count session
          </Typography>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
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
                            Select specific items to count (coming soon)
                          </Typography>
                        </Box>
                      }
                      disabled
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
              A new count session will be created with all active inventory items. You can then
              enter physical counts for each item.
            </Alert>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={startMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? 'Starting...' : 'Start Count Session'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

