import React from 'react';
import { Rating } from '@mui/material';

interface StarVisualProps {
  value: number | null | undefined;
  color: string;
}

export default function StarVisual({ value, color }: StarVisualProps) {
  return (
    <Rating
      value={value ?? 0}
      max={5}
      precision={0.1}
      readOnly
      sx={{
        '& .MuiRating-iconFilled': { color },
        '& .MuiRating-iconEmpty': { color: 'action.disabled' },
        fontSize: '1.5rem',
      }}
    />
  );
}
