'use client';

import React, { useState } from 'react';
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
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useDashboardMetrics } from '@/lib/hooks/use-dashboard-metrics';
import { useCoordinatorMetrics } from '@/lib/hooks/use-coordinator';
import ProgramChangesHoverTooltip from '@/components/coordinator/program-changes-hover-tooltip';
import { useDashboardMembers } from '@/lib/hooks/use-dashboard-member-programs';
import { MemberPrograms } from '@/types/database.types';
import DashboardProgramInfoTab from '@/components/dashboard/dashboard-program-info-tab';
import DashboardProgramScriptTab from '@/components/dashboard/dashboard-program-script-tab';
import DashboardProgramToDoTab from '@/components/dashboard/dashboard-program-todo-tab';
import ProgramChangesTab from '@/components/coordinator/program-changes-tab';
import DashboardProgramItemsTab from '@/components/dashboard/dashboard-program-items-tab';
import DashboardProgramNotesTab from '@/components/dashboard/dashboard-program-notes-tab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: metrics, isLoading, error } = useDashboardMetrics();
  const { data: coordinatorMetrics } = useCoordinatorMetrics();
  const { data: members = [], isLoading: membersLoading, error: membersError } = useDashboardMembers();
  
  // State for member and program selection
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedProgram, setSelectedProgram] = useState<MemberPrograms | null>(null);
  const [tabValue, setTabValue] = useState(0);

  // Handler functions
  const handleMemberChange = (event: any, newValue: any) => {
    setSelectedMember(newValue);
    // Auto-select first program if member has programs
    if (newValue && newValue.programs && newValue.programs.length > 0) {
      setSelectedProgram(newValue.programs[0]);
    } else {
      setSelectedProgram(null);
    }
    setTabValue(0); // Reset to first tab
  };

  const handleProgramChange = (event: any, newValue: any) => {
    setSelectedProgram(newValue);
    setTabValue(0); // Reset to first tab
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };


  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load dashboard metrics: {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
          gutterBottom
        >
          Dashboard
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Card 1: Active Members */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.success.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme => theme.shadows[4],
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
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    Active Members
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'success.main',
                      mt: 1,
                    }}
                  >
                    {isLoading ? (
                      <CircularProgress size={32} color="inherit" />
                    ) : (
                      (metrics?.activeMembers ?? 0).toLocaleString()
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'success.main',
                    opacity: 0.8,
                  }}
                >
                  <PeopleIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Members on active programs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: New Programs This Month */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.primary.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme => theme.shadows[4],
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
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    New Programs This Month
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'primary.main',
                      mt: 1,
                    }}
                  >
                    {isLoading ? (
                      <CircularProgress size={32} color="inherit" />
                    ) : (
                      (metrics?.newProgramsThisMonth ?? 0).toLocaleString()
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'primary.main',
                    opacity: 0.8,
                  }}
                >
                  <SchoolIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Programs with start dates this month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Completed Programs */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.info.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme => theme.shadows[4],
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
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    Completed Programs
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'info.main',
                      mt: 1,
                    }}
                  >
                    {isLoading ? (
                      <CircularProgress size={32} color="inherit" />
                    ) : (
                      (metrics?.completedPrograms ?? 0).toLocaleString()
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'info.main',
                    opacity: 0.8,
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Programs completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 4: Program Changes (This Week) - Same as Coordinator */}
        <Grid size={3}>
          <ProgramChangesHoverTooltip>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: theme => `4px solid ${theme.palette.info.main}`,
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme => theme.shadows[4],
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
                    <Typography
                      color="textSecondary"
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                    >
                      Program Changes (This Week)
                    </Typography>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{
                        fontWeight: 'bold',
                        color: 'info.main',
                        mt: 1,
                      }}
                    >
                      {coordinatorMetrics?.programChangesThisWeek ?? 0}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: 'info.main',
                      opacity: 0.8,
                    }}
                  >
                    <AutoGraphIcon sx={{ fontSize: 40 }} />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.875rem' }}
                >
                  Program modifications this week
                </Typography>
              </CardContent>
            </Card>
          </ProgramChangesHoverTooltip>
        </Grid>
      </Grid>

      {/* Member Program Viewer */}
      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            View Member Programs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select a member to view their active or paused programs
          </Typography>

          {/* Member Selection */}
          <Box sx={{ mb: 3 }}>
            <TextField
              select
              label="Select Member"
              fullWidth
              value={selectedMember?.lead_id || ''}
              onChange={(e) => {
                const memberId = Number(e.target.value);
                const member = members.find(m => m.lead_id === memberId);
                handleMemberChange(null, member);
              }}
              disabled={membersLoading}
              InputProps={{
                endAdornment: membersLoading ? <CircularProgress color="inherit" size={20} /> : null,
              }}
            >
              <MenuItem value="">
                <em>Choose a member...</em>
              </MenuItem>
              {members.map((member) => (
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
                onChange={(e) => {
                  const programId = Number(e.target.value);
                  const program = selectedMember.programs.find((p: MemberPrograms) => p.member_program_id === programId);
                  handleProgramChange(null, program);
                }}
              >
                <MenuItem value="">
                  <em>Choose a program...</em>
                </MenuItem>
                {selectedMember.programs.map((program: MemberPrograms) => (
                  <MenuItem key={program.member_program_id} value={program.member_program_id}>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {program.program_template_name || 'Unnamed Program'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Status: {program.status_name || 'Unknown'}
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

          {/* Program Details Tabs */}
          {selectedProgram && (
            <Box sx={{ mt: 3 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  aria-label="program details tabs"
                  sx={{
                    '& .MuiTab-root': {
                      minHeight: 44,
                      paddingX: 4,
                      marginX: 1,
                    },
                  }}
                >
                  <Tab
                    icon={<DescriptionIcon />}
                    label="PROGRAM"
                    iconPosition="start"
                  />
                  <Tab
                    icon={<AssignmentIcon />}
                    label="Items"
                    iconPosition="start"
                  />
                  <Tab
                    icon={<AssignmentIcon />}
                    label="Notes"
                    iconPosition="start"
                  />
                  <Tab
                    icon={<AssignmentTurnedInIcon />}
                    label="Script"
                    iconPosition="start"
                  />
                  <Tab
                    icon={<AssignmentIcon />}
                    label="To Do"
                    iconPosition="start"
                  />
                <Tab
                  icon={<AutoGraphIcon />}
                  label="Changes"
                  iconPosition="start"
                />
                </Tabs>
              </Box>

              <TabPanel value={tabValue} index={0}>
                <DashboardProgramInfoTab program={selectedProgram} />
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <DashboardProgramItemsTab program={selectedProgram} />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <DashboardProgramNotesTab
                  program={selectedProgram}
                  memberId={selectedMember?.lead_id ?? null}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <DashboardProgramScriptTab program={selectedProgram} />
              </TabPanel>

              <TabPanel value={tabValue} index={4}>
                <DashboardProgramToDoTab program={selectedProgram} />
              </TabPanel>

              <TabPanel value={tabValue} index={5}>
                <ProgramChangesTab
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
    </Box>
  );
}