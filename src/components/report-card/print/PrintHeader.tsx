'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { printStyles } from './print-styles';

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Logo */}
        {logo && (
          <Box sx={{ width: '150px', height: '50px' }}>
            <img
              src={logo}
              alt="Company Logo"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </Box>
        )}

        {/* Report Title */}
        <Box sx={{ textAlign: logo ? 'center' : 'left', flex: 1 }}>
          <Typography variant="h4" fontWeight="bold" color="primary.main">
            Member Progress Report
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {memberName}
          </Typography>
        </Box>

        {/* Report Date */}
        <Box sx={{ textAlign: 'right', minWidth: '120px' }}>
          <Typography variant="caption" color="textSecondary" display="block">
            Generated On
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {reportDate}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}











