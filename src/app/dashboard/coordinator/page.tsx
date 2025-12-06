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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useMemberPrograms } from '@/lib/hooks/use-member-programs';
import CoordinatorScriptTab from '@/components/coordinator/script-tab';
import CoordinatorToDoTab from '@/components/coordinator/todo-tab';
import ProgramChangesTab from '@/components/coordinator/program-changes-tab';
import ProgramChangesHoverTooltip from '@/components/coordinator/program-changes-hover-tooltip';
import { MemberPrograms } from '@/types/database.types';
import { useCoordinatorMetrics } from '@/lib/hooks/use-coordinator';

export default function CoordinatorPage() {
  const { data: programs = [] } = useMemberPrograms() as {
    data: MemberPrograms[] | undefined;
  } as any;
  const { data: metrics } = useCoordinatorMetrics();
  const [tab, setTab] = useState(0);

  // Global filters for grids only
  const [memberFilter, setMemberFilter] = useState<number | null>(null);
  const [range, setRange] = useState<
    'all' | 'today' | 'week' | 'month' | 'custom'
  >('all');
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [hideMissed, setHideMissed] = useState<boolean>(false);


  // Members: only leads with Active programs (matching centralized service logic)
  const memberOptions = useMemo(() => {
    const included = new Set(['active']);
    const filtered = (programs || []).filter((p: any) =>
      included.has((p.status_name || '').toLowerCase())
    );
    const pairs = filtered
      .filter((p: any) => !!p.lead_id)
      .map((p: any) => ({
        id: p.lead_id as number,
        name: (p.lead_name as string) || `Lead #${p.lead_id}`,
      }));
    const seen = new Set<number>();
    const uniq: { id: number; name: string }[] = [];
    for (const pr of pairs) {
      if (!seen.has(pr.id)) {
        seen.add(pr.id);
        uniq.push(pr);
      }
    }
    // Sort alphabetically by name
    return uniq.sort((a, b) => a.name.localeCompare(b.name));
  }, [programs]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
        >
          Coordinator Dashboard
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.error.main}`,
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
                    Late To Do's
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'error.main',
                      mt: 1,
                    }}
                  >
                    {metrics?.lateTasks ?? 0}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'error.main',
                    opacity: 0.8,
                  }}
                >
                  <NotificationsActiveIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Overdue to do's requiring attention
              </Typography>
            </CardContent>
          </Card>
        </Grid>
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
                    To Do's Due Today
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
                    {metrics?.tasksDueToday ?? 0}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'primary.main',
                    opacity: 0.8,
                  }}
                >
                  <TodayIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                To do's scheduled for today
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.secondary.main}`,
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
                    Script Items Due Today
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'secondary.main',
                      mt: 1,
                    }}
                  >
                    {metrics?.apptsDueToday ?? 0}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'secondary.main',
                    opacity: 0.8,
                  }}
                >
                  <EventAvailableIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Script items scheduled for today
              </Typography>
            </CardContent>
          </Card>
        </Grid>
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
                      {metrics?.programChangesThisWeek ?? 0}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Program modifications this week
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </ProgramChangesHoverTooltip>
        </Grid>
      </Grid>

      {/* Filters + Tabs section (separate card to visually associate with grids) */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          {/* Global Filters for grids */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <FilterAltIcon color="primary" />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', flex: 1 }}>
              <TextField
                select
                label="Member"
                value={memberFilter ?? ''}
                onChange={e =>
                  setMemberFilter(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                size="small"
                sx={{ minWidth: 220 }}
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
                  const val = e.target.value as any;
                  setRange(val);
                  if (val === 'custom') {
                    const today = new Date();
                    const iso = today.toISOString().slice(0, 10);
                    setStart(prev => prev || iso);
                    setEnd(prev => prev || iso);
                  } else {
                    // Clear custom dates when switching to preset ranges
                    setStart(null);
                    setEnd(null);
                  }
                }}
                size="small"
                sx={{ minWidth: 180 }}
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
                  />
                  <TextField
                    type="date"
                    label="End"
                    value={end || ''}
                    onChange={e => setEnd(e.target.value || null)}
                    size="small"
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
                label="Show Redeemed / Complete"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hideMissed}
                    onChange={e => setHideMissed(e.target.checked)}
                    size="small"
                    disabled={tab === 2}
                  />
                }
                label="Hide Missed"
              />
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Tabs */}
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ '& .MuiTabs-flexContainer': { gap: 4 } }}
          >
            <Tab icon={<ListAltIcon />} iconPosition="start" label="Script" />
            <Tab
              icon={<AssignmentTurnedInIcon />}
              iconPosition="start"
              label="To Do"
            />
            <Tab
              icon={<AutoGraphIcon />}
              iconPosition="start"
              label="Program Changes"
            />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {tab === 0 && (
              <CoordinatorScriptTab
                memberId={memberFilter}
                range={range}
                {...(start ? { start } : {})}
                {...(end ? { end } : {})}
                showCompleted={showCompleted}
                hideMissed={hideMissed}
              />
            )}
            {tab === 1 && (
              <CoordinatorToDoTab
                memberId={memberFilter}
                range={range}
                {...(start ? { start } : {})}
                {...(end ? { end } : {})}
                showCompleted={showCompleted}
                hideMissed={hideMissed}
              />
            )}
            {tab === 2 && (
              <ProgramChangesTab
                memberId={memberFilter}
                range={range}
                {...(start ? { start } : {})}
                {...(end ? { end } : {})}
              />
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
