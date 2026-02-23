'use client';

import React from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Skeleton,
} from '@mui/material';

/**
 * Loading component for the Leads page that uses spinners and overlays
 * instead of skeletons for a more interactive loading experience.
 */
export default function LeadsPageLoading() {
    return (
        <Box sx={{ p: 0 }}>
            {/* Metrics Cards Loading State */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                {[1, 2, 3, 4].map((i) => (
                    <Grid size={3} key={i}>
                        <Card
                            sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                borderTop: theme => `4px solid ${theme.palette.divider}`,
                            }}
                        >
                            <CardContent sx={{ flexGrow: 1, p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Box>
                                        <Skeleton variant="text" width={100} height={20} />
                                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', height: 48 }}>
                                            <CircularProgress size={24} />
                                        </Box>
                                    </Box>
                                    <Skeleton variant="circular" width={40} height={40} />
                                </Box>
                                <Skeleton variant="text" width="80%" height={20} />
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Table Area Loading State */}
            <Card sx={{ minHeight: 400, position: 'relative' }}>
                <CardContent sx={{ p: 0, height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255, 255, 255, 0.5)' }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <CircularProgress size={40} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            Loading leads...
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
