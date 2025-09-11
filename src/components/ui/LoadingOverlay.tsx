import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function LoadingOverlay({
  loading,
  message = 'Loading...',
  size = 'medium',
}: LoadingOverlayProps) {
  if (!loading) return null;

  const progressSize = size === 'small' ? 24 : size === 'large' ? 48 : 32;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress size={progressSize} />
        <Typography
          variant="body2"
          sx={{
            mt: 1,
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          {message}
        </Typography>
      </Box>
    </Box>
  );
}
