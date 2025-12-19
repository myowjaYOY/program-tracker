'use client';

import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface GenerateScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onGenerateAll: () => void;
  onGenerateRecent: () => void;
  loading?: boolean;
}

/**
 * Generate Schedule Modal
 * 
 * Confirmation dialog before generating schedule.
 * Warns about date overwrites and offers two generation modes:
 * - Generate All: Regenerates schedule for all items
 * - Generate Recent Only: Only generates for items added/updated in last 30 min
 */
export default function GenerateScheduleModal({
  open,
  onClose,
  onGenerateAll,
  onGenerateRecent,
  loading = false,
}: GenerateScheduleModalProps) {
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
            Confirm Action
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            Generate Schedule
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
          {/* Warning Alert */}
          <Alert severity="warning">
            <Typography variant="body2">
              <strong>Warning:</strong> If you have manually changed any scheduled dates, 
              those changes will be overwritten by this operation.
            </Typography>
          </Alert>

          {/* Instructions */}
          <Typography variant="body2" color="text.secondary">
            Choose how you want to generate the schedule:
          </Typography>

          {/* Option Descriptions */}
          <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 0 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Generate All Items:</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 2 }}>
              Regenerates the schedule for ALL program items. Use this when you want a complete refresh.
            </Typography>

            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Generate Recent Items Only:</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
              Only generates schedule for items added or updated in the last 30 minutes. 
              Use this after adding new items to preserve existing schedule dates.
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'grey.50',
          flexDirection: 'column',
          gap: 1,
          alignItems: 'stretch',
        }}
      >
        <Button
          onClick={onGenerateAll}
          disabled={loading}
          variant="contained"
          fullWidth
          sx={{ borderRadius: 0, fontWeight: 600 }}
        >
          {loading ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} /> Generating...
            </>
          ) : (
            'Generate All Items'
          )}
        </Button>
        <Button
          onClick={onGenerateRecent}
          disabled={loading}
          variant="outlined"
          fullWidth
          sx={{ borderRadius: 0, fontWeight: 600 }}
        >
          Generate Recent Items Only (Last 30 min)
        </Button>
        <Button
          onClick={handleClose}
          disabled={loading}
          color="inherit"
          fullWidth
          sx={{ borderRadius: 0 }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

