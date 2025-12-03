'use client';

import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';

type JobStatus = 'running' | 'completed' | 'failed' | 'pending' | 'processing' | 'partial';

interface JobStatusChipProps {
  status: string;
  size?: ChipProps['size'];
}

const statusConfig: Record<JobStatus, { color: ChipProps['color']; icon: React.ReactElement; label: string }> = {
  running: {
    color: 'info',
    icon: <HourglassEmptyIcon fontSize="small" />,
    label: 'Running',
  },
  processing: {
    color: 'info',
    icon: <HourglassEmptyIcon fontSize="small" />,
    label: 'Processing',
  },
  pending: {
    color: 'default',
    icon: <ScheduleIcon fontSize="small" />,
    label: 'Pending',
  },
  completed: {
    color: 'success',
    icon: <CheckCircleIcon fontSize="small" />,
    label: 'Completed',
  },
  partial: {
    color: 'warning',
    icon: <WarningIcon fontSize="small" />,
    label: 'Partial',
  },
  failed: {
    color: 'error',
    icon: <ErrorIcon fontSize="small" />,
    label: 'Failed',
  },
};

export default function JobStatusChip({ status, size = 'small' }: JobStatusChipProps) {
  const normalizedStatus = status.toLowerCase() as JobStatus;
  const config = statusConfig[normalizedStatus];
  
  // Use explicit fallback for unknown status
  const chipColor = config?.color ?? 'default';
  const chipIcon = config?.icon ?? <ScheduleIcon fontSize="small" />;
  const chipLabel = config?.label ?? status;

  return (
    <Chip
      icon={chipIcon}
      label={chipLabel}
      color={chipColor}
      size={size}
      sx={{
        fontWeight: 600,
        '& .MuiChip-icon': {
          marginLeft: '4px',
        },
      }}
    />
  );
}

