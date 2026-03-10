'use client';

import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/**
 * Color configuration for metric cards
 * Maps semantic color names to MUI theme palette paths
 */
export type MetricCardColor = 'success' | 'info' | 'primary' | 'error' | 'secondary' | 'warning';

/**
 * Menu action configuration for card dropdown menus
 */
export interface MetricCardMenuAction {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

/**
 * Props for the MetricCard component
 */
export interface MetricCardProps {
    /** Card title displayed at the top */
    title: string;
    /** Main numeric or text value to display prominently */
    value: number | string;
    /** Theme color for the top border and value text */
    color: MetricCardColor;
    /** Icon displayed in the top-right corner - should include sx={{ fontSize: 40 }} */
    icon: React.ReactNode;
    /** Shows loading spinner instead of value when true */
    isLoading?: boolean;
    /** Description text displayed below the value (e.g., "Members on active programs") */
    description?: string | undefined;
    /** Optional menu actions shown via three-dot menu */
    menuActions?: MetricCardMenuAction[] | undefined;
    /** Optional tooltip component to wrap around the card content (for complex hover cards) */
    tooltipWrapper?: React.ComponentType<{ children: React.ReactElement }> | undefined;
    /** Optional click handler for the entire card */
    onClick?: () => void;
    /** Test ID for automated testing */
    testId?: string;
}

/**
 * MetricCard Component
 * 
 * A reusable dashboard metric card that displays a title, value, and icon
 * with consistent styling across the application.
 * 
 * Features:
 * - Colored top border matching the value color
 * - Loading state with spinner
 * - Optional dropdown menu with actions
 * - Optional tooltip wrapper for hover information
 * - Hover animation effects
 * 
 * @example
 * ```tsx
 * <MetricCard
 *   title="Active Members"
 *   value={currentMetrics?.activeMembers ?? 0}
 *   color="success"
 *   icon={<PeopleIcon />}
 *   isLoading={isMetricsLoading}
 *   menuActions={[
 *     { label: 'View All', icon: <VisibilityIcon />, onClick: handleViewAll }
 *   ]}
 * />
 * ```
 */
export default function MetricCard({
    title,
    value,
    color,
    icon,
    isLoading = false,
    description,
    menuActions,
    tooltipWrapper: TooltipWrapper,
    onClick,
    testId,
}: MetricCardProps) {
    // Menu state management
    const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
    const menuOpen = Boolean(menuAnchor);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setMenuAnchor(event.currentTarget);
    };

    const handleMenuClose = () => {
        setMenuAnchor(null);
    };

    const handleMenuAction = (action: MetricCardMenuAction) => {
        handleMenuClose();
        action.onClick();
    };

    // Map color prop to MUI theme paths
    const colorMap: Record<MetricCardColor, string> = {
        success: 'success.main',
        info: 'info.main',
        primary: 'primary.main',
        error: 'error.main',
        secondary: 'secondary.main',
        warning: 'warning.main',
    };

    const cardContent = (
        <Card
            data-testid={testId}
            onClick={onClick}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: (theme) => `4px solid ${theme.palette[color].main}`,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
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
                    {/* Title and Menu */}
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <Typography
                            color="textSecondary"
                            variant="body2"
                            sx={{ fontWeight: 500 }}
                        >
                            {title}
                        </Typography>

                        {/* Optional Menu */}
                        {menuActions && menuActions.length > 0 && (
                            <>
                                <IconButton
                                    size="small"
                                    onClick={handleMenuOpen}
                                    sx={{
                                        ml: 'auto',
                                        color: 'text.secondary',
                                        '&:hover': {
                                            color: 'primary.main',
                                        },
                                    }}
                                >
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                                <Menu
                                    anchorEl={menuAnchor}
                                    open={menuOpen}
                                    onClose={handleMenuClose}
                                    anchorOrigin={{
                                        vertical: 'bottom',
                                        horizontal: 'right',
                                    }}
                                    transformOrigin={{
                                        vertical: 'top',
                                        horizontal: 'right',
                                    }}
                                >
                                    {menuActions.map((action, index) => (
                                        <MenuItem
                                            key={index}
                                            onClick={() => handleMenuAction(action)}
                                        >
                                            <ListItemIcon>{action.icon}</ListItemIcon>
                                            <ListItemText>{action.label}</ListItemText>
                                        </MenuItem>
                                    ))}
                                </Menu>
                            </>
                        )}
                    </Box>

                    {/* Icon */}
                    <Box
                        sx={{
                            color: colorMap[color],
                            opacity: 0.8,
                            '& .MuiSvgIcon-root': {
                                fontSize: 40,
                            },
                        }}
                    >
                        {icon}
                    </Box>
                </Box>

                {/* Value */}
                <Typography
                    variant="h3"
                    component="div"
                    sx={{
                        fontWeight: 'bold',
                        color: colorMap[color],
                        mt: 1,
                    }}
                >
                    {isLoading ? (
                        <CircularProgress size={32} color="inherit" />
                    ) : (
                        value
                    )}
                </Typography>

                {/* Optional Description */}
                {description && (
                    <Typography variant="caption" color="textSecondary">
                        {description}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );

    // Wrap with tooltip if provided
    if (TooltipWrapper) {
        return <TooltipWrapper>{cardContent}</TooltipWrapper>;
    }

    return cardContent;
}

/**
 * Configuration type for defining multiple metric cards
 * Useful for mapping over card configurations
 */
export interface MetricCardConfig {
    title: string;
    valueKey: string;
    color: MetricCardColor;
    icon: React.ReactNode;
    subtitle?: string;
    menuActions?: MetricCardMenuAction[];
    tooltipWrapper?: React.ComponentType<{ children: React.ReactElement }>;
}