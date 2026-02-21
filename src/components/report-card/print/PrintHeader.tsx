'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { printStyles } from './print-styles';
import { getUiIcon } from '@/lib/utils/pdf-icons';

interface PrintHeaderProps {
  memberName: string;
  reportDate: string;
  logo?: string;
}

export default function PrintHeader({
  memberName,
  reportDate,
  logo,
}: PrintHeaderProps) {
  return (
    <Box sx={printStyles.header}>
      {/* Title & Member Info */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          {/* Use <span> instead of <div> to avoid nesting block element issues */}
          <span
            dangerouslySetInnerHTML={{ __html: getUiIcon('report', { size: 36, color: '#ffffff' }) }}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          />
          <Typography
            variant="h1"
            sx={{
              fontSize: '36px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.5px',
              m: 0,
            }}
          >
            Member Report Card
          </Typography>
        </Box>
        <Typography
          variant="h5"
          sx={{
            fontSize: '20px',
            color: '#e9d5ff',
            fontWeight: 600,
            m: 0,
          }}
        >
          {memberName}
        </Typography>
      </Box>

      {/* Metadata Badge */}
      <Box sx={printStyles.headerMetadata}>
        <Typography
          variant="caption"
          sx={{
            fontSize: '10px',
            color: '#e9d5ff',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            fontWeight: 600,
            display: 'block',
            mb: 0.5
          }}
        >
          Generated On
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#ffffff'
          }}
        >
          {reportDate}
        </Typography>
      </Box>
    </Box>
  );
}