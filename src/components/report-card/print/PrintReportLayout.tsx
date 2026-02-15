'use client';

import React, { ReactNode } from 'react';
import { Box, Container } from '@mui/material';
import PrintHeader from './PrintHeader';
import PrintFooter from './PrintFooter';
import { printStyles } from './print-styles';

interface PrintReportLayoutProps {
  children: ReactNode;
  memberName: string;
  reportDate: string;
  logo?: string;
  confidentialityNotice?: string;
}

export default function PrintReportLayout({
  children,
  memberName,
  reportDate,
  logo,
  confidentialityNotice,
}: PrintReportLayoutProps) {
  return (
    <Box sx={printStyles.page}>
      {/* Centered Container for Print */}
      <Container maxWidth="lg" sx={{ p: 0 }}>
        <PrintHeader
          memberName={memberName}
          reportDate={reportDate}
          {...(logo ? { logo } : {})}
        />

        <Box sx={{ minHeight: '8in', py: 2 }}>
          {children}
        </Box>

        <PrintFooter
          {...(confidentialityNotice ? { confidentialityNotice } : {})}
        />
      </Container>
    </Box>
  );
}
