'use client';

import React, { useMemo, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Tab,
    Tabs,
    Typography,
    MenuItem,
    TextField,
    Divider,
    Grid,
    Checkbox,
    FormControlLabel,
} from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { Today as TodayIcon } from '@mui/icons-material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import CoordinatorScriptTab from '@/components/coordinator/script-tab';
import CoordinatorToDoTab from '@/components/coordinator/todo-tab';
import ProgramChangesTab from '@/components/coordinator/program-changes-tab';
import ProgramChangesHoverTooltip from '@/components/coordinator/program-changes-hover-tooltip';
import MetricCard from '@/components/ui/MetricCard';
import TabPanel, { a11yProps } from '@/components/ui/TabPanel';
import { useCoordinatorMetrics } from '@/lib/hooks/use-coordinator';
import type { CoordinatorData } from '@/lib/data/coordinator';

interface CoordinatorPageClientProps {
    initialData: CoordinatorData;
}

export default function CoordinatorPageClient({ initialData }: CoordinatorPageClientProps) {
    // Use React Query with initial data from server
    const { data: metrics, isLoading: metricsLoading } = useCoordinatorMetrics({
        initialData: initialData.metrics,
    });

    // Use server-provided member options (no need to refetch)
    const memberOptions = initialData.memberOptions;

    // Tab state
    const [tab, setTab] = useState(0);

    // Filter state
    const [memberFilter, setMemberFilter] = useState<number | null>(null);
    const [range, setRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
    const [start, setStart] = useState<string | null>(null);
    const [end, setEnd] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState<boolean>(false);
    const [showMissed, setShowMissed] = useState<boolean>(false);

    // Memoized filter props to prevent unnecessary re-renders
    const filterProps = useMemo(() => ({
        memberId: memberFilter,
        range,
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
        showCompleted,
        showMissed,
    }), [memberFilter, range, start, end, showCompleted, showMissed]);

    // Program changes filter props (without showCompleted/showMissed)
    const programChangesFilterProps = useMemo(() => ({
        memberId: memberFilter,
        range,
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
    }), [memberFilter, range, start, end]);

    return (
        <Box>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        title="Late To Do's"
                        value={metrics?.lateTasks ?? 0}
                        color="error"
                        icon={<NotificationsActiveIcon />}
                        isLoading={metricsLoading}
                        description="Tasks past their due date"
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        title="Due Today"
                        value={metrics?.tasksDueToday ?? 0}
                        color="warning"
                        icon={<TodayIcon />}
                        isLoading={metricsLoading}
                        description="Tasks due today"
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        title="Appts Today"
                        value={metrics?.apptsDueToday ?? 0}
                        color="info"
                        icon={<EventAvailableIcon />}
                        isLoading={metricsLoading}
                        description="Script items scheduled today"
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        title="Program Changes"
                        value={metrics?.programChangesThisWeek ?? 0}
                        color="info"
                        icon={<AutoGraphIcon />}
                        isLoading={metricsLoading}
                        description="Program modifications this week"
                        tooltipWrapper={ProgramChangesHoverTooltip}
                    />
                </Grid>
            </Grid>

            {/* Filters + Tabs section */}
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    {/* Global Filters */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <FilterAltIcon color="primary" />
                        <Box
                            sx={{
                                display: 'flex',
                                gap: 2,
                                flexWrap: 'wrap',
                                flex: 1,
                                alignItems: 'center',
                            }}
                        >
                            <TextField
                                select
                                label="Member"
                                value={memberFilter ?? ''}
                                onChange={e =>
                                    setMemberFilter(e.target.value ? Number(e.target.value) : null)
                                }
                                size="small"
                                sx={{ minWidth: { xs: '100%', sm: 220 } }}
                            >
                                <MenuItem value="">All Members</MenuItem>
                                {memberOptions.map(m => (
                                    <MenuItem key={m.id} value={m.id}>
                                        {m.name}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                select
                                label="Date Range"
                                value={range}
                                onChange={e => {
                                    const val = e.target.value as typeof range;
                                    setRange(val);
                                    if (val === 'custom') {
                                        const today = new Date();
                                        const iso = today.toISOString().slice(0, 10);
                                        setStart(prev => prev || iso);
                                        setEnd(prev => prev || iso);
                                    } else {
                                        setStart(null);
                                        setEnd(null);
                                    }
                                }}
                                size="small"
                                sx={{ minWidth: { xs: '100%', sm: 180 } }}
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="today">Today</MenuItem>
                                <MenuItem value="week">This Week</MenuItem>
                                <MenuItem value="month">This Month</MenuItem>
                                <MenuItem value="custom">Custom</MenuItem>
                            </TextField>

                            {range === 'custom' && (
                                <>
                                    <TextField
                                        type="date"
                                        label="Start"
                                        value={start || ''}
                                        onChange={e => setStart(e.target.value || null)}
                                        size="small"
                                        sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />
                                    <TextField
                                        type="date"
                                        label="End"
                                        value={end || ''}
                                        onChange={e => setEnd(e.target.value || null)}
                                        size="small"
                                        sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />
                                </>
                            )}

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={showCompleted}
                                        onChange={e => setShowCompleted(e.target.checked)}
                                        size="small"
                                        disabled={tab === 2}
                                    />
                                }
                                label={
                                    <Typography variant="body2">Show Redeemed / Complete</Typography>
                                }
                            />

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={showMissed}
                                        onChange={e => setShowMissed(e.target.checked)}
                                        size="small"
                                        disabled={tab === 2}
                                    />
                                }
                                label={
                                    <Typography variant="body2">Show Missed</Typography>
                                }
                            />
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {/* Tabs */}
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            '& .MuiTabs-flexContainer': { gap: { xs: 1, md: 4 } },
                        }}
                    >
                        <Tab
                            icon={<ListAltIcon />}
                            iconPosition="start"
                            label="Script"
                            {...a11yProps('coordinator', 0)}
                        />
                        <Tab
                            icon={<AssignmentTurnedInIcon />}
                            iconPosition="start"
                            label="To Do"
                            {...a11yProps('coordinator', 1)}
                        />
                        <Tab
                            icon={<AutoGraphIcon />}
                            iconPosition="start"
                            label="Program Changes"
                            {...a11yProps('coordinator', 2)}
                        />
                    </Tabs>

                    {/* Tab Content */}
                    <TabPanel value={tab} index={0} idPrefix="coordinator">
                        <CoordinatorScriptTab {...filterProps} />
                    </TabPanel>

                    <TabPanel value={tab} index={1} idPrefix="coordinator">
                        <CoordinatorToDoTab {...filterProps} />
                    </TabPanel>

                    <TabPanel value={tab} index={2} idPrefix="coordinator">
                        <ProgramChangesTab {...programChangesFilterProps} />
                    </TabPanel>
                </CardContent>
            </Card>
        </Box>
    );
}