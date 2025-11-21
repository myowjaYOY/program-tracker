'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  EventAvailable as ScheduledIcon,
  EventNote as ActualIcon,
  TrendingFlat as ArrowIcon,
} from '@mui/icons-material';
import { format, parseISO, differenceInDays } from 'date-fns';

interface ScheduleAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  promptData: {
    scheduledDate?: string;
    redemptionDate?: string;
    futureInstanceCount: number;
    itemDetails?: {
      therapyName?: string;
      instanceNumber?: number;
      daysBetween?: number;
    };
  } | null;
  onConfirm: (adjust: boolean) => void;
  loading?: boolean;
}

/**
 * Schedule Adjustment Modal
 * 
 * Shown when user redeems an item on a different date than scheduled
 * and there are future instances that could be adjusted.
 * 
 * Displays:
 * - Date difference (early/late)
 * - Number of future instances affected
 * - Therapy name and instance number
 * 
 * User choices:
 * - "Yes, Adjust" - Updates scheduled_date and cascades to future instances
 * - "No, Keep Original" - Marks redeemed but keeps original scheduled_date
 */
export default function ScheduleAdjustmentModal({
  open,
  onClose,
  promptData,
  onConfirm,
  loading = false,
}: ScheduleAdjustmentModalProps) {
  if (!promptData || !promptData.scheduledDate || !promptData.redemptionDate) return null;

  const { scheduledDate, redemptionDate, futureInstanceCount, itemDetails } = promptData;

  // Calculate date difference
  const scheduled = parseISO(scheduledDate);
  const actual = parseISO(redemptionDate);
  const daysDiff = Math.abs(differenceInDays(actual, scheduled));
  const isLate = actual > scheduled;
  const isEarly = actual < scheduled;

  // Format dates for display
  const scheduledDisplay = format(scheduled, 'MMM d, yyyy');
  const actualDisplay = format(actual, 'MMM d, yyyy');

  const handleYes = () => {
    onConfirm(true);
  };

  const handleNo = () => {
    onConfirm(false);
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduledIcon color="primary" />
          <Typography variant="h6" component="span">
            Adjust Future Schedule?
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            You're marking this item as <strong>redeemed</strong> on a different date than scheduled.
            Would you like to adjust future instances to match?
          </Typography>
        </Alert>

        <Divider sx={{ my: 2 }} />

        {/* Therapy Info */}
        {itemDetails?.therapyName && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Therapy
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {itemDetails.therapyName}
              {itemDetails.instanceNumber && ` - Instance ${itemDetails.instanceNumber}`}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Date Comparison */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Scheduled Date
              </Typography>
              <Chip
                icon={<ScheduledIcon />}
                label={scheduledDisplay}
                size="small"
                sx={{ mt: 0.5 }}
              />
            </Box>
            
            <ArrowIcon color="action" />
            
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Actual Date
              </Typography>
              <Chip
                icon={<ActualIcon />}
                label={actualDisplay}
                color={isLate ? 'warning' : isEarly ? 'info' : 'default'}
                size="small"
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Box>

          {/* Difference Display */}
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Chip
              label={`${daysDiff} day${daysDiff !== 1 ? 's' : ''} ${isLate ? 'late' : isEarly ? 'early' : ''}`}
              color={isLate ? 'warning' : isEarly ? 'info' : 'default'}
              size="small"
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Future Instances Info */}
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{futureInstanceCount}</strong> future instance{futureInstanceCount !== 1 ? 's' : ''} will be affected
            {itemDetails?.daysBetween && ` (spaced ${itemDetails.daysBetween} days apart)`}
          </Typography>
        </Alert>

        <Divider sx={{ my: 2 }} />

        {/* Explanation */}
        <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 0 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>If you choose "Yes":</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 2 }}>
            • This instance's scheduled date will update to {actualDisplay}
            <br />
            • All {futureInstanceCount} future instance{futureInstanceCount !== 1 ? 's' : ''} will shift by {daysDiff} day{daysDiff !== 1 ? 's' : ''}
            <br />
            • Associated tasks will also adjust
          </Typography>

          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>If you choose "No":</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
            • This instance will be marked as redeemed
            <br />
            • The scheduled date will remain {scheduledDisplay}
            <br />
            • Future instances won't change
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleNo}
          disabled={loading}
          variant="outlined"
          color="inherit"
          sx={{ borderRadius: 0 }}
        >
          No, Keep Original
        </Button>
        <Button
          onClick={handleYes}
          disabled={loading}
          variant="contained"
          color="primary"
          autoFocus
          sx={{ borderRadius: 0 }}
        >
          {loading ? 'Adjusting...' : 'Yes, Adjust Future Dates'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

