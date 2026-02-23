'use client';

import React from 'react';
import {
  Box,
  Skeleton,
  Card,
  CardContent,
  Grid,
} from '@mui/material';

/**
 * Next.js shows this immediately when navigating to /dashboard/leads,
 * before the async page data loads. Restores instant navigation feedback.
 */
export default function LeadsLoading() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Header Skeleton */}
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={200} height={40} />
      </Box>

      {/* Metrics Cards Skeleton */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[1, 2, 3, 4].map((i) => (
          <Grid size={3} key={i}>
            <Card
              sx={{
                height: '100%',
                borderTop: (theme) =>
                  `4px solid ${theme.palette.divider}`,
                transition:
                  'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: (theme) => theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Skeleton variant="text" width={120} height={24} />
                    <Skeleton
                      variant="text"
                      width={60}
                      height={36}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>
                <Skeleton variant="text" width="80%" height={20} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Table Skeleton */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Skeleton variant="text" width={100} height={40} />
            <Skeleton
              variant="rectangular"
              width={120}
              height={40}
              sx={{ borderRadius: 1 }}
            />
          </Box>
          <Skeleton
            variant="rectangular"
            width="100%"
            height={500}
            sx={{ borderRadius: 1 }}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
