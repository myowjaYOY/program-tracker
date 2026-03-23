import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

interface ProgressBarVisualProps {
  /** 0–1 ratio of actual / target */
  progress: number;
  color: string;
}

export default function ProgressBarVisual({ progress, color }: ProgressBarVisualProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const pct = Math.round(clamped * 100);

  return (
    <Box sx={{ width: 140 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 10,
          borderRadius: 5,
          backgroundColor: '#e8e8e8',
          '& .MuiLinearProgress-bar': {
            backgroundColor: color,
            borderRadius: 5,
          },
        }}
      />
      <Typography
        variant="caption"
        sx={{ fontSize: '0.6rem', color: 'text.secondary', mt: 0.5, display: 'block', textAlign: 'right' }}
      >
        {pct}% of limit
      </Typography>
    </Box>
  );
}
