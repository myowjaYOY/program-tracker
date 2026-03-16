import React from 'react';
import { Box } from '@mui/material';

interface SparkVisualProps {
  /** Array of data points representing the trend over time */
  trend: number[];
  color: string;
}

const WIDTH = 160;
const HEIGHT = 40;
const PADDING = 2;

export default function SparkVisual({ trend, color }: SparkVisualProps) {
  if (trend.length < 2) return null;

  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const range = max - min || 1;

  const points = trend.map((v, i) => {
    const x = PADDING + (i / (trend.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((v - min) / range) * (HEIGHT - PADDING * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const last = points[points.length - 1]!;
  const first = points[0]!;
  const areaPath =
    linePath +
    ` L ${last.x} ${HEIGHT} L ${first.x} ${HEIGHT} Z`;

  return (
    <Box sx={{ py: 0.5 }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <path d={areaPath} fill={color} opacity={0.1} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
  );
}
