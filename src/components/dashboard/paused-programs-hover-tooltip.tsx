'use client';

import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { usePausedProgramsPreview } from '@/lib/hooks/use-paused-programs-preview';

interface PausedProgramsHoverTooltipProps {
  children: React.ReactElement;
}

export default function PausedProgramsHoverTooltip({
  children,
}: PausedProgramsHoverTooltipProps) {
  const { data = [], isLoading, error } = usePausedProgramsPreview();

  const tooltipContent = (
    <Box sx={{ p: 1.5, maxWidth: 300 }}>
      {isLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.primary">
            Loading...
          </Typography>
        </Box>
      ) : error ? (
        <Typography variant="body2" color="error">
          Failed to load paused programs
        </Typography>
      ) : data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No paused programs
        </Typography>
      ) : (
        <>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              mb: 1, 
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Members with paused programs:
          </Typography>
          {/* Get unique member names */}
          {[...new Set(data.map(item => item.member_name))].map((memberName, index) => (
            <Typography
              key={`${memberName}-${index}`}
              variant="body2"
              sx={{ 
                mb: 0.5,
                fontSize: '0.8rem',
                lineHeight: 1.3,
                color: 'text.primary',
              }}
            >
              {memberName}
            </Typography>
          ))}
        </>
      )}
    </Box>
  );

  return (
    <Tooltip
      title={tooltipContent}
      placement="top"
      arrow
      enterDelay={300}
      leaveDelay={200}
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: 1,
            borderColor: 'divider',
            boxShadow: 3,
            '& .MuiTooltip-arrow': {
              color: 'background.paper',
              '&::before': {
                border: 1,
                borderColor: 'divider',
              },
            },
          },
        },
      }}
    >
      {children}
    </Tooltip>
  );
}



