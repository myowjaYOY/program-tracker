'use client';

import React from 'react';
import { Chip, ChipProps, alpha, useTheme } from '@mui/material';

export type StatusColorMode = 
  | 'success' // Green
  | 'warning' // Orange/Yellow
  | 'error'   // Red
  | 'info'    // Blue
  | 'default' // Gray
  | 'primary' // Theme Primary
  | 'secondary'; // Theme Secondary

export interface StatusChipProps extends Omit<ChipProps, 'color'> {
  /** The predefined layout and color map key for the chip */
  statusColor?: StatusColorMode;
  /** 
   * The text label configuration. Will fall back to title-case of statusColor 
   * if label is not provided.
   */
  label: React.ReactNode;
  /** Whether to use the outlined variant that mimics classic pills */
  solid?: boolean;
}

/**
 * A resilient and reusable status chip that automatically sets correct 
 * color combinations based on a simple 'statusColor' semantic prop.
 */
export default function StatusChip({
  statusColor = 'default',
  label,
  solid = false,
  sx,
  ...rest
}: StatusChipProps) {
  const theme = useTheme();

  // Create custom styling overrides mapping if 'solid' is false (soft background)
  // When solid=true, MUI's default Chip implementation with standard colors works great.
  const softStyles = React.useMemo(() => {
    if (solid || statusColor === 'default') return {};

    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      success: {
        bg: alpha(theme.palette.success.main, 0.1),
        text: theme.palette.success.dark,
        border: theme.palette.success.main,
      },
      warning: {
        bg: alpha(theme.palette.warning.main, 0.1),
        text: theme.palette.warning.dark,
        border: theme.palette.warning.main,
      },
      error: {
        bg: alpha(theme.palette.error.main, 0.1),
        text: theme.palette.error.dark,
        border: theme.palette.error.main,
      },
      info: {
        bg: alpha(theme.palette.info.main, 0.1),
        text: theme.palette.info.dark,
        border: theme.palette.info.main,
      },
      primary: {
        bg: alpha(theme.palette.primary.main, 0.1),
        text: theme.palette.primary.dark,
        border: theme.palette.primary.main,
      },
      secondary: {
        bg: alpha(theme.palette.secondary.main, 0.1),
        text: theme.palette.secondary.dark,
        border: theme.palette.secondary.main,
      },
    };

    const target = colorMap[statusColor];
    if (!target) return {};

    return {
      backgroundColor: target.bg,
      color: target.text,
      fontWeight: 600,
      '& .MuiChip-icon': {
        color: target.text,
      },
    };
  }, [solid, statusColor, theme]);

  return (
    <Chip
      label={label}
      color={statusColor === 'default' ? 'default' : (statusColor as any)}
      variant={solid ? 'filled' : 'outlined'}
      sx={{
        borderRadius: 1, // slightly squared vs pure pill
        ...softStyles,
        ...sx,
      }}
      size="small"
      {...rest}
    />
  );
}
