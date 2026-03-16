import React from 'react';
import { Box, Typography } from '@mui/material';

interface GaugeVisualProps {
  /** 0–1 ratio of actual / target */
  progress: number;
  color: string;
}

const SIZE = 80;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = Math.PI * RADIUS;

export default function GaugeVisual({ progress, color }: GaugeVisualProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const filledLength = clamped * CIRCUMFERENCE;
  const gapLength = CIRCUMFERENCE - filledLength;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg
        width={SIZE}
        height={SIZE / 2 + 4}
        viewBox={`0 0 ${SIZE} ${SIZE / 2 + 4}`}
      >
        {/* Background track */}
        <path
          d={`M ${STROKE / 2} ${CENTER} A ${RADIUS} ${RADIUS} 0 0 1 ${SIZE - STROKE / 2} ${CENTER}`}
          fill="none"
          stroke="#e0e0e0"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d={`M ${STROKE / 2} ${CENTER} A ${RADIUS} ${RADIUS} 0 0 1 ${SIZE - STROKE / 2} ${CENTER}`}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filledLength} ${gapLength}`}
        />
      </svg>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: -0.5, fontSize: '0.65rem' }}
      >
        Pace
      </Typography>
    </Box>
  );
}
