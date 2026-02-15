'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { printStyles } from './print-styles';
import PrintIcon from './PrintIcon';

interface PrintFooterProps {
  confidentialityNotice?: string;
}

export default function PrintFooter({
  confidentialityNotice = 'This report contains confidential health information. Please handle with appropriate privacy and security measures.',
}: PrintFooterProps) {
  return (
    <Box sx={printStyles.footer}>
      <Box sx={{
        mb: 1.5,
        p: 1.5,
        bgcolor: 'rgba(255, 255, 255, 0.6)',
        borderRadius: '8px',
        display: 'inline-block',
        maxWidth: '500px'
      }}>
        <Typography sx={{
          m: 0,
          fontSize: '12px',
          color: '#5a0ea4',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5
        }}>
          <PrintIcon type="ui" name="lock" size={12} color="#5a0ea4" /> {confidentialityNotice}
        </Typography>
      </Box>
      <Typography sx={{
        m: 0,
        fontSize: '11px',
        color: '#8b5cf6',
        fontWeight: 600
      }}>
        © {new Date().getFullYear()} Program Tracker • Powered by Advanced Health Analytics
      </Typography>
    </Box>
  );
}
