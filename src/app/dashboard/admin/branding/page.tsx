'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Button,
    Grid,
    TextField,
    Divider,
    CircularProgress,
    Paper,
    Chip,
    Alert,
} from '@mui/material';
import {
    Palette as PaletteIcon,
    Save as SaveIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTenantSettings, useUpdateTenantSettings } from '@/lib/hooks/use-tenant-settings';

export default function BrandingPage() {
    const { data: settingsData, isLoading } = useTenantSettings();
    const updateSettings = useUpdateTenantSettings();
    const [primaryColor, setPrimaryColor] = useState('#8e24ff');

    useEffect(() => {
        if (settingsData?.settings?.branding?.primary_color) {
            setPrimaryColor(settingsData.settings.branding.primary_color);
        }
    }, [settingsData]);

    const handleSave = () => {
        updateSettings.mutate({
            branding: {
                primary_color: primaryColor,
            },
        });
    };

    const handleReset = () => {
        setPrimaryColor('#8e24ff'); // Default Purple Heart 600
    };

    if (isLoading) {
        return (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4, maxWidth: 1000, mx: 'auto' }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h4" fontWeight={700} gutterBottom sx={{ color: 'text.primary' }}>
                        Platform Branding
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Personalize your organization's environment with custom colors and theme settings.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={handleReset}
                        disabled={updateSettings.isPending}
                        sx={{ borderRadius: 0 }}
                    >
                        Default
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={updateSettings.isPending ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        onClick={handleSave}
                        disabled={updateSettings.isPending}
                        sx={{ borderRadius: 0, fontWeight: 600, px: 4 }}
                    >
                        Save Branding
                    </Button>
                </Box>
            </Box>

            <Divider sx={{ mb: 4 }} />

            <Grid container spacing={4}>
                {/* Configuration Section */}
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <Card variant="outlined" sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 4 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                                    <PaletteIcon sx={{ color: primaryColor }} />
                                    <Typography variant="h6" fontWeight={600}>
                                        Theme Primary Color
                                    </Typography>
                                </Box>

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                                    The primary color is used for key interface elements like buttons, active navigation items,
                                    and the top header bar. Choose a color that matches your organization's brand.
                                </Typography>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                                        <Box
                                            sx={{
                                                width: 80,
                                                height: 80,
                                                borderRadius: 0,
                                                backgroundColor: primaryColor,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <Typography variant="caption" fontWeight={600} color="text.secondary">
                                                HEX COLOR CODE
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    value={primaryColor}
                                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                                    placeholder="#8e24ff"
                                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                                                />
                                                <Box
                                                    component="input"
                                                    type="color"
                                                    value={primaryColor}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrimaryColor(e.target.value)}
                                                    sx={{
                                                        width: 40,
                                                        height: 40,
                                                        p: 0,
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        cursor: 'pointer',
                                                        backgroundColor: 'transparent',
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                                            PRESET BRAND COLORS
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                                            {['#8e24ff', '#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#0097a7', '#424242'].map((color) => (
                                                <Box
                                                    key={color}
                                                    onClick={() => setPrimaryColor(color)}
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        backgroundColor: color,
                                                        cursor: 'pointer',
                                                        border: primaryColor === color ? '2px solid #000' : '1px solid transparent',
                                                        outline: primaryColor === color ? '2px solid #fff' : 'none',
                                                        transition: 'transform 0.1s',
                                                        '&:hover': { transform: 'scale(1.1)' }
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>

                        <Alert severity="info" sx={{ borderRadius: 0 }}>
                            Changes will be applied immediately across your organization's platform once saved.
                        </Alert>
                    </Box>
                </Grid>

                {/* Preview Section */}
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Live Components Preview
                    </Typography>

                    <Paper
                        variant="outlined"
                        sx={{
                            p: 0,
                            borderRadius: 0,
                            backgroundColor: '#fafafa',
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        {/* Fake Header */}
                        <Box sx={{ height: 56, backgroundColor: primaryColor, display: 'flex', alignItems: 'center', px: 3, gap: 2 }}>
                            <Box sx={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.3)' }} />
                            <Box sx={{ flex: 1, height: 16, maxWidth: 120, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                            <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        </Box>

                        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {/* Dashboard Elements */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Card sx={{ flex: 1, borderRadius: 0, borderLeft: `4px solid ${primaryColor}` }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>TOTAL REVENUE</Typography>
                                        <Typography variant="h5" fontWeight={700} sx={{ color: primaryColor }}>$42,850</Typography>
                                    </CardContent>
                                </Card>
                                <Card sx={{ flex: 1, borderRadius: 0 }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>ACTIVE USERS</Typography>
                                        <Typography variant="h5" fontWeight={700}>1,284</Typography>
                                    </CardContent>
                                </Card>
                            </Box>

                            {/* Forms & Inputs */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <TextField
                                    label="Example Input"
                                    defaultValue="Focused State"
                                    fullWidth
                                    size="small"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 0,
                                            '&.Mui-focused fieldset': { borderColor: primaryColor },
                                        },
                                        '& .MuiInputLabel-root.Mui-focused': { color: primaryColor }
                                    }}
                                />

                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant="contained"
                                        sx={{
                                            borderRadius: 0,
                                            backgroundColor: primaryColor,
                                            boxShadow: 'none',
                                            '&:hover': { backgroundColor: primaryColor, opacity: 0.9, boxShadow: 'none' }
                                        }}
                                    >
                                        Action Button
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        sx={{
                                            borderRadius: 0,
                                            color: primaryColor,
                                            borderColor: primaryColor,
                                            '&:hover': { borderColor: primaryColor, backgroundColor: 'rgba(0,0,0,0.02)' }
                                        }}
                                    >
                                        Secondary
                                    </Button>
                                </Box>
                            </Box>

                            {/* Badges/Chips */}
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Chip
                                    label="Completed"
                                    size="small"
                                    sx={{ backgroundColor: primaryColor, color: '#fff', borderRadius: 0, fontWeight: 700 }}
                                />
                                <Chip
                                    label="In Progress"
                                    variant="outlined"
                                    size="small"
                                    sx={{ color: primaryColor, borderColor: primaryColor, borderRadius: 0, fontWeight: 700 }}
                                />
                                <Typography variant="body2" sx={{ ml: 'auto', color: primaryColor, fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                                    View Details →
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
