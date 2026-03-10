'use client';

import React from 'react';
import { Box, Card, CardContent, Grid, Skeleton } from '@mui/material';

function MetricCardSkeleton() {
    return (
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ height: 140, borderTop: '4px solid #e0e0e0' }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width={100} height={20} />
                        </Box>
                        <Skeleton variant="circular" width={40} height={40} />
                    </Box>
                    <Skeleton variant="text" width={60} height={48} sx={{ mt: 1 }} />
                    <Skeleton variant="text" width={180} height={16} sx={{ mt: 1 }} />
                </CardContent>
            </Card>
        </Grid>
    );
}

export default function CoordinatorPageSkeleton() {
    return (
        <Box>
            {/* Metrics Cards Skeleton */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
            </Grid>

            {/* Filters + Tabs Card Skeleton */}
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    {/* Filters Row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Skeleton variant="circular" width={24} height={24} />
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', flex: 1 }}>
                            <Skeleton variant="rectangular" width={220} height={40} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="rectangular" width={180} height={40} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="rectangular" width={180} height={24} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="rectangular" width={120} height={24} sx={{ borderRadius: 1 }} />
                        </Box>
                    </Box>

                    <Skeleton variant="rectangular" width="100%" height={1} sx={{ mb: 2 }} />

                    {/* Tabs Row */}
                    <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
                        <Skeleton variant="rectangular" width={100} height={48} sx={{ borderRadius: 1 }} />
                        <Skeleton variant="rectangular" width={90} height={48} sx={{ borderRadius: 1 }} />
                        <Skeleton variant="rectangular" width={150} height={48} sx={{ borderRadius: 1 }} />
                    </Box>

                    {/* Table Skeleton */}
                    <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 1 }} />
                </CardContent>
            </Card>
        </Box>
    );
}