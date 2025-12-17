'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  FormControlLabel,
  Checkbox,
  IconButton,
  TextField,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, parseISO, differenceInDays } from 'date-fns';

interface DateChangeModalProps {
  open: boolean;
  onClose: () => void;
  currentDate: string;
  futureInstanceCount: number;
  itemDetails?: {
    therapyName?: string;
    instanceNumber?: number;
    daysBetween?: number;
  };
  onConfirm: (newDate: string, adjustFuture: boolean) => void;
  loading?: boolean;
}

/**
 * Date Change Modal
 * 
 * Allows user to change the scheduled date of an item.
 * If there are future instances, offers option to cascade the change.
 */
export default function DateChangeModal({
  open,
  onClose,
  currentDate,
  futureInstanceCount,
  itemDetails,
  onConfirm,
  loading = false,
}: DateChangeModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [adjustFuture, setAdjustFuture] = useState(true);

  // Reset state when modal opens
  useEffect(() => {
    if (open && currentDate) {
      setSelectedDate(parseISO(currentDate));
      setAdjustFuture(true);
    }
  }, [open, currentDate]);

  if (!currentDate) return null;

  const current = parseISO(currentDate);
  const currentDisplay = format(current, 'MMM d, yyyy');

  // Calculate difference if a new date is selected
  const hasNewDate = selectedDate && format(selectedDate, 'yyyy-MM-dd') !== currentDate;
  const daysDiff = selectedDate ? Math.abs(differenceInDays(selectedDate, current)) : 0;
  const isLater = selectedDate ? selectedDate > current : false;
  const isEarlier = selectedDate ? selectedDate < current : false;

  const handleConfirm = () => {
    if (!selectedDate) return;
    const newDateStr = format(selectedDate, 'yyyy-MM-dd');
    onConfirm(newDateStr, futureInstanceCount > 0 ? adjustFuture : false);
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      {/* Colored Header */}
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          px: 3,
          py: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ opacity: 0.9, display: 'block', lineHeight: 1 }}>
            Change Scheduled Date
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {itemDetails?.therapyName || 'Schedule Item'}
            {itemDetails?.instanceNumber && ` - Instance ${itemDetails.instanceNumber}`}
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={loading}
          size="small"
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Current Date Display */}
          <TextField
            label="Current Date"
            value={currentDisplay}
            fullWidth
            disabled
            size="small"
          />

          {/* New Date Picker */}
          <DatePicker
            label="New Date"
            value={selectedDate}
            onChange={(newValue) => setSelectedDate(newValue)}
            slotProps={{
              textField: {
                fullWidth: true,
                size: 'small',
              },
            }}
          />

          {/* Date Difference Display */}
          {hasNewDate && (
            <Typography variant="body2" color={isLater ? 'warning.main' : 'info.main'}>
              {daysDiff} day{daysDiff !== 1 ? 's' : ''} {isLater ? 'later' : isEarlier ? 'earlier' : ''}
            </Typography>
          )}

          {/* Future Instances Checkbox */}
          {futureInstanceCount > 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={adjustFuture}
                  onChange={(e) => setAdjustFuture(e.target.checked)}
                  disabled={loading}
                />
              }
              label={`Also adjust ${futureInstanceCount} future instance${futureInstanceCount !== 1 ? 's' : ''}`}
            />
          )}

          {/* Info Alert */}
          <Alert severity="info">
            {futureInstanceCount === 0
              ? 'This is the last pending instance. Only this date will be changed.'
              : adjustFuture
                ? `This will shift all ${futureInstanceCount} future instance${futureInstanceCount !== 1 ? 's' : ''} and their associated tasks.`
                : 'Only this instance will be changed. Future instances will remain unchanged.'}
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{ borderRadius: 0 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading || !hasNewDate}
          variant="contained"
          sx={{ borderRadius: 0, fontWeight: 600, minWidth: 120 }}
        >
          {loading ? 'Saving...' : 'Change Date'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
