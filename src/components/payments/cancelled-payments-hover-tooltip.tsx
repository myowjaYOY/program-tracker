'use client';

import React from 'react';
import { Box, Typography, Tooltip, CircularProgress } from '@mui/material';
import { usePaymentMetrics } from '@/lib/hooks/use-payments';

interface CancelledPaymentsHoverTooltipProps {
  children: React.ReactElement;
}

export default function CancelledPaymentsHoverTooltip({
  children,
}: CancelledPaymentsHoverTooltipProps) {
  const { data, isLoading, error } = usePaymentMetrics();

  const cancelledPaymentsBreakdown = data?.cancelledPaymentsBreakdown || [];

  const tooltipContent = (
    <Box sx={{ p: 1.5, maxWidth: 350 }}>
      {isLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.primary">
            Loading...
          </Typography>
        </Box>
      ) : error ? (
        <Typography variant="body2" color="error">
          Failed to load cancelled payments
        </Typography>
      ) : cancelledPaymentsBreakdown.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No cancelled payments
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
            Members with cancelled payments:
          </Typography>
          {cancelledPaymentsBreakdown.map((item, index) => (
            <Typography
              key={`${item.memberId}-${index}`}
              variant="body2"
              sx={{
                mb: 0.5,
                fontSize: '0.8rem',
                lineHeight: 1.3,
                color: 'text.primary',
              }}
            >
              {item.memberName} | $
              {Math.round(item.amount).toLocaleString('en-US')}
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
