'use client';

import React from 'react';
import { Box } from '@mui/material';
import { printStyles } from './print-styles';
import PrintHeader from './PrintHeader';
import PrintFooter from './PrintFooter';

interface PrintReportLayoutProps {
  memberName: string;
  reportDate?: string;
  logo?: string;
  children: React.ReactNode;
}

export default function PrintReportLayout({
  memberName,
  reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  logo,
  children,
}: PrintReportLayoutProps) {
  return (
    <Box sx={printStyles.page}>
      <PrintHeader
        memberName={memberName}
        reportDate={reportDate}
        {...(logo && { logo })}
      />
      
      {children}
      
      <PrintFooter />
    </Box>
  );
}


