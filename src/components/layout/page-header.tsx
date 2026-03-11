'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

export interface PageHeaderProps {
  /** Primary title for the page */
  title: React.ReactNode;
  /** Optional subtitle or description text below the title */
  subtitle?: React.ReactNode;
  /** Action buttons (e.g., 'Add New', 'Export') rendered on the right side */
  actions?: React.ReactNode;
  /** Bottom margin to apply to the header block. Defaults to 3 (24px) */
  mb?: number | string;
}

/**
 * A standardized page header featuring a main title, optional subtitle,
 * and an optional actions area aligned to the right.
 */
export default function PageHeader({ 
  title, 
  subtitle, 
  actions,
  mb = 3,
}: PageHeaderProps) {
  return (
    <Box 
      sx={{ 
        mb,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 2, sm: 0 },
      }}
    >
      <Box>
        {typeof title === 'string' ? (
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            color="primary.main"
            gutterBottom={!!subtitle}
          >
            {title}
          </Typography>
        ) : (
          title
        )}

        {subtitle && (
          typeof subtitle === 'string' ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : (
            subtitle
          )
        )}
      </Box>

      {actions && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
