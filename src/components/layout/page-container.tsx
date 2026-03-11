'use client';

import React from 'react';
import { Box, BoxProps } from '@mui/material';

export interface PageContainerProps extends BoxProps {
  children: React.ReactNode;
}

/**
 * A standard layout container for all main pages.
 * Applies consistent padding and ensures full height behavior for layout stability.
 */
export default function PageContainer({ children, sx, ...rest }: PageContainerProps) {
  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        height: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
