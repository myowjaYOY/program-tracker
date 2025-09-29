'use client';

import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { useCoordinatorProgramChangesPreview } from '@/lib/hooks/use-coordinator-program-changes-preview';

interface ProgramChangesHoverTooltipProps {
  children: React.ReactElement;
}

export default function ProgramChangesHoverTooltip({
  children,
}: ProgramChangesHoverTooltipProps) {
  const { data = [], isLoading, error } = useCoordinatorProgramChangesPreview();

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
          Failed to load changes
        </Typography>
      ) : data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No changes this week
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
            Programs with changes:
          </Typography>
          {data.map((item, index) => (
            <Typography
              key={`${item.member_name}-${item.program_name}-${index}`}
              variant="body2"
              sx={{ 
                mb: 0.5,
                fontSize: '0.8rem',
                lineHeight: 1.3,
                color: 'text.primary',
              }}
            >
              {item.member_name} | {item.program_name}
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
