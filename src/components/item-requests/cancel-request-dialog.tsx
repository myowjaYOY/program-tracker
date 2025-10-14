'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useCancelItemRequest } from '@/lib/hooks/use-item-requests';

interface CancelRequestDialogProps {
  open: boolean;
  onClose: () => void;
  requestId: number;
  itemDescription: string;
}

export default function CancelRequestDialog({
  open,
  onClose,
  requestId,
  itemDescription,
}: CancelRequestDialogProps) {
  const [cancellationReason, setCancellationReason] = useState('');
  const cancelRequest = useCancelItemRequest();

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      return; // TextField validation will show error
    }

    try {
      await cancelRequest.mutateAsync({
        id: requestId,
        reason: cancellationReason.trim(),
      });
      // Success - close dialog and reset
      setCancellationReason('');
      onClose();
    } catch (error) {
      // Error toast is shown by the hook
      console.error('Cancel request error:', error);
    }
  };

  const handleClose = () => {
    if (!cancelRequest.isPending) {
      setCancellationReason('');
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Cancel Item Request
        <IconButton
          edge="end"
          color="inherit"
          onClick={handleClose}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            You are about to cancel the following request:
          </Typography>
          <Typography variant="body1" fontWeight="medium" sx={{ mt: 1 }}>
            {itemDescription}
          </Typography>
        </Box>

        <Alert severity="warning" sx={{ mb: 2 }}>
          This action cannot be undone. Please provide a reason for cancellation.
        </Alert>

        <TextField
          label="Cancellation Reason"
          multiline
          rows={4}
          fullWidth
          required
          value={cancellationReason}
          onChange={(e) => setCancellationReason(e.target.value)}
          placeholder="e.g., Item no longer needed, duplicate request, etc."
          disabled={cancelRequest.isPending}
          error={!cancellationReason.trim() && cancellationReason.length > 0}
          helperText={
            !cancellationReason.trim() && cancellationReason.length > 0
              ? 'Cancellation reason is required'
              : `${cancellationReason.length}/500 characters`
          }
          inputProps={{ maxLength: 500 }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleCancel}
          variant="contained"
          color="error"
          disabled={!cancellationReason.trim() || cancelRequest.isPending}
          sx={{ borderRadius: 0 }}
        >
          {cancelRequest.isPending ? 'Cancelling...' : 'Confirm Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}



