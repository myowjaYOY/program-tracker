'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { printStyles } from './print-styles';

interface PrintFooterProps {
  confidentialityNotice?: string;
}

export default function PrintFooter({
  confidentialityNotice = 'This report contains confidential health information. Please handle with appropriate privacy and security measures.',
}: PrintFooterProps) {
  return (
    <Box sx={printStyles.footer}>
      <Typography variant="caption" display="block" gutterBottom>
        {confidentialityNotice}
      </Typography>
      <Typography variant="caption" color="textSecondary">
        © {new Date().getFullYear()} Program Tracker. All rights reserved.
      </Typography>
    </Box>
  );
}










