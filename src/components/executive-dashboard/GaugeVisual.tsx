import React from 'react';
import { Box } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';

interface GaugeVisualProps {
  /** 0–1 ratio of actual / target */
  progress: number;
  color: string;
}

export default function GaugeVisual({ progress, color }: GaugeVisualProps) {
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <Box sx={{ width: 120, height: 80 }}>
      <Gauge
        value={pct}
        valueMin={0}
        valueMax={100}
        startAngle={-110}
        endAngle={110}
        innerRadius="72%"
        outerRadius="100%"
        cornerRadius={4}
        text={`${pct}%`}
        sx={{
          [`& .${gaugeClasses.valueArc}`]: {
            fill: color,
          },
          [`& .${gaugeClasses.referenceArc}`]: {
            fill: '#e8e8e8',
          },
          [`& .${gaugeClasses.valueText}`]: {
            fontSize: 14,
            fontWeight: 700,
            fill: color,
          },
        }}
      />
    </Box>
  );
}
