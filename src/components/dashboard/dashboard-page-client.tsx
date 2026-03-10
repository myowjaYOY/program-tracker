'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    CircularProgress,
    Alert,
    TextField,
    MenuItem,
    Tabs,
    Tab,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import ListIcon from '@mui/icons-material/List';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useDashboardMetrics } from '@/lib/hooks/use-dashboard-metrics';
import { useCoordinatorMetrics } from '@/lib/hooks/use-coordinator';
import ProgramChangesHoverTooltip from '@/components/coordinator/program-changes-hover-tooltip';
import PausedProgramsHoverTooltip from '@/components/dashboard/paused-programs-hover-tooltip';
import { useDashboardMembers, DashboardMember } from '@/lib/hooks/use-dashboard-member-programs';
import { MemberPrograms } from '@/types/database.types';
import ActiveMembersModal from '@/components/dashboard/active-members-modal';
import { DashboardData } from '@/lib/data/dashboard';
import MetricCard, { MetricCardColor, MetricCardMenuAction, MetricCardProps } from '@/components/ui/MetricCard';
import TabPanel, { a11yProps } from '@/components/ui/TabPanel';

// ============================================
// DIRECT IMPORTS FOR TAB COMPONENTS
// ============================================
// Note: We use direct imports instead of React.lazy() here because:
// 1. Lazy loading inside an already-hydrated SSR component causes race conditions
// 2. The tabs are relatively small and the user will likely view most of them
// 3. This avoids hydration mismatches and intermittent loading issues
import DashboardProgramInfoTab from '@/components/dashboard/dashboard-program-info-tab';
import DashboardProgramItemsTab from '@/components/dashboard/dashboard-program-items-tab';
import DashboardProgramNotesTab from '@/components/dashboard/dashboard-program-notes-tab';
import DashboardProgramScriptTab from '@/components/dashboard/dashboard-program-script-tab';
import DashboardProgramToDoTab from '@/components/dashboard/dashboard-program-todo-tab';
import DashboardProgramRashaTab from '@/components/dashboard/dashboard-program-rasha-tab';
import ProgramChangesTab from '@/components/coordinator/program-changes-tab';

// Type for metric card configuration (allows optional props to be omitted)
type MetricCardConfig = Pick<MetricCardProps, 'title' | 'value' | 'color' | 'icon'> &
    Partial<Pick<MetricCardProps, 'description' | 'menuActions' | 'tooltipWrapper'>>;

// ============================================
// MAIN COMPONENT
// ============================================

interface DashboardPageClientProps {
    initialData: DashboardData;
}

export default function DashboardPageClient({ initialData }: DashboardPageClientProps) {
    // ============================================
    // DATA FETCHING WITH SSR HYDRATION
    // ============================================

    // IMPORTANT: For hydration safety, we use initialData on first render
    // and let React Query update in the background. This prevents mismatches
    // between server-rendered HTML and initial client render.

    const {
        data: metricsData,
        isLoading: isMetricsLoading,
        isFetched: isMetricsFetched
    } = useDashboardMetrics();

    const {
        data: coordinatorMetricsData,
        isFetched: isCoordinatorFetched
    } = useCoordinatorMetrics();

    const {
        data: membersData,
        isLoading: membersLoading,
        error: membersError
    } = useDashboardMembers();

    // Use initialData for first render (hydration), then switch to fetched data
    // This ensures server HTML matches initial client render
    const currentMetrics = isMetricsFetched ? (metricsData ?? initialData.metrics) : initialData.metrics;
    const currentCoordinatorMetrics = isCoordinatorFetched ? coordinatorMetricsData : initialData.coordinatorMetrics;
    const members = membersData ?? initialData.members;

    // ============================================
    // STATE MANAGEMENT
    // ============================================

    const [selectedMember, setSelectedMember] = useState<DashboardMember | null>(null);
    const [selectedProgram, setSelectedProgram] = useState<MemberPrograms | null>(null);
    const [tabValue, setTabValue] = useState(0);

    // Active Members modal state
    const [activeMembersModalOpen, setActiveMembersModalOpen] = useState(false);

    // ============================================
    // MEMOIZED HANDLERS
    // ============================================

    const handleMemberChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const memberId = Number(event.target.value);
        const member = members.find((m: DashboardMember) => m.lead_id === memberId) || null;
        setSelectedMember(member);

        // Auto-select first program if member has programs
        if (member && member.programs && member.programs.length > 0) {
            setSelectedProgram(member.programs[0] ?? null);
        } else {
            setSelectedProgram(null);
        }
        setTabValue(0); // Reset to first tab
    }, [members]);

    const handleProgramChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedMember) return;
        const programId = Number(event.target.value);
        const program = selectedMember.programs.find(
            (p: MemberPrograms) => p.member_program_id === programId
        );
        setSelectedProgram(program || null);
        setTabValue(0); // Reset to first tab
    }, [selectedMember]);

    const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    }, []);

    const handleViewActiveMembers = useCallback(() => {
        setActiveMembersModalOpen(true);
    }, []);

    // ============================================
    // MEMOIZED METRIC CARDS CONFIGURATION
    // ============================================

    const metricCardsConfig: MetricCardConfig[] = useMemo(() => [
        {
            title: 'Active Members',
            value: currentMetrics?.activeMembers ?? 0,
            color: 'success' as MetricCardColor,
            icon: <PeopleIcon />,
            description: 'Members on active programs',
            menuActions: [
                {
                    label: 'View All Members',
                    icon: <VisibilityIcon fontSize="small" />,
                    onClick: handleViewActiveMembers,
                },
            ] as MetricCardMenuAction[],
        },
        {
            title: 'New Programs This Month',
            value: currentMetrics?.newProgramsThisMonth ?? 0,
            color: 'info' as MetricCardColor,
            icon: <SchoolIcon />,
            description: 'Programs with start dates this month',
        },
        {
            title: 'Completed Programs',
            value: currentMetrics?.completedPrograms ?? 0,
            color: 'primary' as MetricCardColor,
            icon: <CheckCircleIcon />,
            description: 'Programs completed',
        },
        {
            title: 'Program Changes (This Week)',
            value: currentCoordinatorMetrics?.programChangesThisWeek ?? 0,
            color: 'secondary' as MetricCardColor,
            icon: <AutoGraphIcon />,
            description: 'Program modifications this week',
            tooltipWrapper: ProgramChangesHoverTooltip,
        },
        {
            title: 'Paused Programs',
            value: currentMetrics?.pausedPrograms ?? 0,
            color: 'error' as MetricCardColor,
            icon: <PauseCircleIcon />,
            description: 'Programs currently paused',
            tooltipWrapper: PausedProgramsHoverTooltip,
        },
    ], [currentMetrics, currentCoordinatorMetrics, handleViewActiveMembers]);

    // ============================================
    // TAB CONFIGURATION
    // ============================================

    const tabConfig = useMemo(() => [
        { icon: <InfoOutlinedIcon />, label: 'Info' },
        { icon: <AssignmentTurnedInIcon />, label: 'Items' },
        { icon: <DescriptionIcon />, label: 'Notes' },
        { icon: <AssignmentIcon />, label: 'Script' },
        { icon: <AssignmentIcon />, label: 'To Do' },
        { icon: <ListIcon />, label: 'RASHA' },
        { icon: <AutoGraphIcon />, label: 'Changes' },
    ], []);

    // ============================================
    // RENDER
    // ============================================

    return (
        <Box sx={{ p: 0 }}>
            {/* ============================================ */}
            {/* METRICS CARDS - Using Reusable MetricCard */}
            {/* ============================================ */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {metricCardsConfig.map((config, index) => (
                    <Grid key={index} size={{ xs: 6, sm: 4, md: 2.4 }}>
                        <MetricCard
                            title={config.title}
                            value={config.value}
                            color={config.color}
                            icon={config.icon}
                            isLoading={!currentMetrics && isMetricsLoading}
                            {...(config.description !== undefined && { description: config.description })}
                            {...(config.menuActions !== undefined && { menuActions: config.menuActions })}
                            {...(config.tooltipWrapper !== undefined && { tooltipWrapper: config.tooltipWrapper })}
                            testId={`metric-card-${config.title.toLowerCase().replace(/\s+/g, '-')}`}
                        />
                    </Grid>
                ))}
            </Grid>

            {/* ============================================ */}
            {/* MEMBER/PROGRAM SELECTION & TABS */}
            {/* ============================================ */}
            <Card>
                <CardContent>
                    {/* Member Selection Dropdown */}
                    <Box sx={{ mb: 3 }}>
                        <TextField
                            select
                            label="Select Member"
                            fullWidth
                            value={selectedMember?.lead_id || ''}
                            onChange={handleMemberChange}
                            disabled={membersLoading}
                            InputProps={{
                                endAdornment: membersLoading ? (
                                    <CircularProgress color="inherit" size={20} />
                                ) : null,
                            }}
                        >
                            <MenuItem value="">
                                <em>Choose a member...</em>
                            </MenuItem>
                            {members.map((member: DashboardMember) => (
                                <MenuItem key={member.lead_id} value={member.lead_id}>
                                    {member.lead_name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>

                    {/* Program Selection (if member has multiple programs) */}
                    {selectedMember && selectedMember.programs.length > 1 && (
                        <Box sx={{ mb: 3 }}>
                            <TextField
                                select
                                label="Select Program"
                                fullWidth
                                value={selectedProgram?.member_program_id || ''}
                                onChange={handleProgramChange}
                            >
                                <MenuItem value="">
                                    <em>Choose a program...</em>
                                </MenuItem>
                                {selectedMember.programs.map((program: MemberPrograms) => (
                                    <MenuItem
                                        key={program.member_program_id}
                                        value={program.member_program_id}
                                    >
                                        <Box>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                {(program as any).template_name || 'Unnamed Program'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Status: {(program as any).status_name || 'Unknown'}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>
                    )}

                    {/* Error Handling */}
                    {membersError && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            Failed to load members: {membersError.message}
                        </Alert>
                    )}

                    {/* ============================================ */}
                    {/* PROGRAM DETAILS TABS */}
                    {/* ============================================ */}
                    {selectedProgram && (
                        <Box sx={{ mt: 3 }}>
                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tabs
                                    value={tabValue}
                                    onChange={handleTabChange}
                                    variant="scrollable"
                                    scrollButtons="auto"
                                    allowScrollButtonsMobile
                                    aria-label="Program details tabs"
                                    sx={{
                                        '& .MuiTab-root': {
                                            minWidth: { xs: 'auto', sm: 120 },
                                            px: { xs: 1, sm: 2 },
                                        },
                                    }}
                                >
                                    {tabConfig.map((tab, index) => (
                                        <Tab
                                            key={index}
                                            icon={tab.icon}
                                            label={tab.label}
                                            iconPosition="start"
                                            {...a11yProps('dashboard', index)}
                                        />
                                    ))}
                                </Tabs>
                            </Box>

                            {/* Tab Panels */}
                            {/* Key props ensure clean remount when program changes, preventing stale state */}
                            <TabPanel value={tabValue} index={0} idPrefix="dashboard">
                                <DashboardProgramInfoTab
                                    key={`info-${selectedProgram.member_program_id}`}
                                    program={selectedProgram}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={1} idPrefix="dashboard">
                                <DashboardProgramItemsTab
                                    key={`items-${selectedProgram.member_program_id}`}
                                    program={selectedProgram}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={2} idPrefix="dashboard">
                                <DashboardProgramNotesTab
                                    key={`notes-${selectedProgram.member_program_id}`}
                                    program={selectedProgram}
                                    memberId={selectedMember?.lead_id ?? null}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={3} idPrefix="dashboard">
                                <DashboardProgramScriptTab
                                    key={`script-${selectedProgram.member_program_id}`}
                                    program={selectedProgram}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={4} idPrefix="dashboard">
                                <DashboardProgramToDoTab
                                    key={`todo-${selectedProgram.member_program_id}`}
                                    program={selectedProgram}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={5} idPrefix="dashboard">
                                <DashboardProgramRashaTab
                                    key={`rasha-${selectedProgram.member_program_id}`}
                                    program={selectedProgram}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={6} idPrefix="dashboard">
                                <ProgramChangesTab
                                    key={`changes-${selectedMember?.lead_id ?? 'none'}`}
                                    memberId={selectedMember?.lead_id ?? null}
                                    range="all"
                                    showMemberColumn={false}
                                />
                            </TabPanel>
                        </Box>
                    )}

                    {/* No Selection Message */}
                    {!selectedMember && !membersLoading && (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="body1" color="text.secondary">
                                Select a member above to view their program details
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Active Members Modal */}
            <ActiveMembersModal
                open={activeMembersModalOpen}
                onClose={() => setActiveMembersModalOpen(false)}
            />
        </Box>
    );
}