'use client';

import React, { useMemo } from 'react';
import { ThemeProvider, createTheme, Theme } from '@mui/material/styles';
import { useTenant } from '@/lib/contexts/TenantContext';
import { theme as defaultTheme } from '@/styles/theme';

interface DynamicThemeProviderProps {
    children: React.ReactNode;
}

export function DynamicThemeProvider({ children }: DynamicThemeProviderProps) {
    const { tenant } = useTenant();

    const theme = useMemo(() => {
        const primaryColor = tenant?.settings?.branding?.primary_color;

        if (!primaryColor) {
            return defaultTheme;
        }

        try {
            // Create a new theme that overrides the primary color
            // We clone the existing theme structure but inject the new primary
            return createTheme({
                ...defaultTheme,
                palette: {
                    ...defaultTheme.palette,
                    primary: {
                        ...defaultTheme.palette.primary,
                        main: primaryColor,
                        // MUI createTheme will automatically calculate light/dark if we don't provide them,
                        // but since we are merging, it's safer to let it recalculate or just provide the main.
                    },
                },
                // Re-apply component overrides that might depend on primary color
                components: {
                    ...defaultTheme.components,
                    MuiAppBar: {
                        styleOverrides: {
                            root: {
                                backgroundColor: primaryColor,
                            },
                        },
                    },
                },
            });
        } catch (error) {
            console.error('Error generating dynamic theme:', error);
            return defaultTheme;
        }
    }, [tenant?.settings?.branding?.primary_color]);

    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
