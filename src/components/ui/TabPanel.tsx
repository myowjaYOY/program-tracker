'use client';

import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';

export interface TabPanelProps {
    children?: React.ReactNode;
    /** Current active tab index */
    value: number;
    /** This panel's index */
    index: number;
    /** Base ID for accessibility (e.g., "coordinator", "dashboard") */
    idPrefix?: string;
    /** Custom padding/styling for the content wrapper */
    sx?: SxProps<Theme>;
    /** Whether to keep children mounted when hidden (for preserving state) */
    keepMounted?: boolean;
}

/**
 * TabPanel Component
 * 
 * A reusable tab panel wrapper that handles visibility and accessibility.
 * 
 * @example
 * ```tsx
 * <TabPanel value={tabValue} index={0} idPrefix="coordinator">
 *   <MyTabContent />
 * </TabPanel>
 * ```
 */
export default function TabPanel({
    children,
    value,
    index,
    idPrefix = 'tab',
    sx,
    keepMounted = false,
}: TabPanelProps) {
    const isActive = value === index;

    // If not keepMounted and not active, render nothing
    if (!keepMounted && !isActive) {
        return null;
    }

    return (
        <div
            role="tabpanel"
            hidden={!isActive}
            id={`${idPrefix}-tabpanel-${index}`}
            aria-labelledby={`${idPrefix}-tab-${index}`}
        >
            {isActive && (
                <Box sx={{ pt: 2, ...sx }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

/**
 * Helper to generate a11y props for Tab components
 * 
 * @example
 * ```tsx
 * <Tab label="Script" {...a11yProps('coordinator', 0)} />
 * ```
 */
export function a11yProps(idPrefix: string, index: number) {
    return {
        id: `${idPrefix}-tab-${index}`,
        'aria-controls': `${idPrefix}-tabpanel-${index}`,
    };
}