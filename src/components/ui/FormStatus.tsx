'use client';

import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface FormStatusState {
  ok: boolean;
  message: string;
}

interface FormStatusProps {
  status: FormStatusState | null;
  onClose?: () => void;
  autoHideMs?: number;
}

/**
 * Small, reusable inline form status banner used next to action buttons.
 * Shows success (green) or error (red) text; optionally auto-hides on success.
 */
export default function FormStatus({
  status,
  onClose,
  autoHideMs = 4000,
}: FormStatusProps) {
  React.useEffect(() => {
    if (status?.ok && autoHideMs > 0) {
      const t = setTimeout(() => onClose?.(), autoHideMs);
      return () => clearTimeout(t);
    }
  }, [status, autoHideMs, onClose]);

  if (!status) return null;

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      role="status"
      aria-live={status.ok ? 'polite' : 'assertive'}
    >
      <Typography
        variant="body2"
        sx={{
          color: status.ok ? 'success.main' : 'error.main',
          fontWeight: 500,
        }}
      >
        {status.message}
      </Typography>
      {onClose && (
        <IconButton size="small" onClick={onClose} aria-label="dismiss message">
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}
