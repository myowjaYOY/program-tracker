import React from 'react';
import { Slider, Box } from '@mui/material';

interface SliderVisualProps {
  /** 0–1 ratio of actual / target */
  progress: number;
  color: string;
}

export default function SliderVisual({ progress, color }: SliderVisualProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const pct = Math.round(clamped * 100);

  return (
    <Box sx={{ width: 140, px: 0.5 }}>
      <Slider
        value={pct}
        min={0}
        max={100}
        disabled
        valueLabelDisplay="auto"
        valueLabelFormat={() => `${pct}%`}
        sx={{
          height: 8,
          '& .MuiSlider-thumb': {
            width: 16,
            height: 16,
            backgroundColor: color,
            border: '2px solid #fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            '&.Mui-disabled': {
              backgroundColor: color,
            },
          },
          '& .MuiSlider-track': {
            backgroundColor: color,
            border: 'none',
          },
          '& .MuiSlider-rail': {
            backgroundColor: '#e0e0e0',
            opacity: 1,
          },
          '&.Mui-disabled': {
            color,
          },
        }}
      />
    </Box>
  );
}
