'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { MemberListItem } from '@/app/api/report-card/dashboard-metrics/route';

interface MetricCardWithTooltipProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  tooltipData?: MemberListItem[];
  tooltipTitle?: string;
  isLoading?: boolean;
}

export default function MetricCardWithTooltip({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  tooltipData,
  tooltipTitle,
  isLoading = false,
}: MetricCardWithTooltipProps) {
  const tooltipContent = tooltipData && tooltipData.length > 0 ? (
    <Box sx={{ p: 1.5, maxWidth: 350 }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          mb: 1, 
          fontWeight: 600,
          color: 'text.primary',
        }}
      >
        {tooltipTitle || 'Details:'}
      </Typography>
      {tooltipData.map((item, index) => (
        <Typography
          key={`${item.name}-${index}`}
          variant="body2"
          sx={{ 
            mb: 0.5,
            fontSize: '0.8rem',
            lineHeight: 1.3,
            color: 'text.primary',
          }}
        >
          {item.name} - {item.value}
        </Typography>
      ))}
    </Box>
  ) : null;

  const cardContent = (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: `4px solid ${color}`,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': tooltipData && tooltipData.length > 0 ? {
          transform: 'translateY(-2px)',
          boxShadow: theme => theme.shadows[4],
        } : {},
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Box sx={{ flex: 1, pr: 1 }}>
            <Typography
              color="textSecondary"
              variant="caption"
              sx={{ fontWeight: 600, fontSize: '0.7rem', lineHeight: 1.2 }}
            >
              {title}
            </Typography>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 'bold',
                color: color,
                mt: 0.5,
                fontSize: '1rem',
                lineHeight: 1.2,
              }}
            >
              {isLoading ? <CircularProgress size={20} /> : value}
            </Typography>
          </Box>
          <Box
            sx={{
              color: color,
              opacity: 0.8,
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 32 }} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {tooltipData && tooltipData.length > 0 && (
            <InfoOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}
          >
            {subtitle}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  // If no tooltip data, return plain card
  if (!tooltipContent) {
    return cardContent;
  }

  // Wrap with tooltip
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
      {cardContent}
    </Tooltip>
  );
}

