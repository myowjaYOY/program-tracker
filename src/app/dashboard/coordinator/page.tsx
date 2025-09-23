'use client';

import React, { useMemo, useState } from 'react';
import { Box, Card, CardContent, Tab, Tabs, Typography, MenuItem, TextField, Divider } from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import TodayIcon from '@mui/icons-material/Today';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { useMemberPrograms } from '@/lib/hooks/use-member-programs';
import CoordinatorScriptTab from '@/components/coordinator/script-tab';
import CoordinatorToDoTab from '@/components/coordinator/todo-tab';
import ProgramChangesTab from '@/components/coordinator/program-changes-tab';
import { MemberPrograms } from '@/types/database.types';
import { useCoordinatorMetrics } from '@/lib/hooks/use-coordinator';

export default function CoordinatorPage() {
  const { data: programs = [] } = useMemberPrograms() as { data: MemberPrograms[] | undefined } as any;
  const { data: metrics } = useCoordinatorMetrics();
  const [tab, setTab] = useState(0);

  // Global filters for grids only
  const [memberFilter, setMemberFilter] = useState<number | null>(null);
  const [range, setRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  // Members: only leads with programs not Cancelled/Completed
  const memberOptions = useMemo(() => {
    const allowed = new Set(['active', 'paused', 'quote']);
    const filtered = (programs || []).filter((p: any) => allowed.has((p.status_name || '').toLowerCase()));
    const pairs = filtered
      .filter((p: any) => !!p.lead_id)
      .map((p: any) => ({ id: p.lead_id as number, name: (p.lead_name as string) || `Lead #${p.lead_id}` }));
    const seen = new Set<number>();
    const uniq: { id: number; name: string }[] = [];
    for (const pr of pairs) { if (!seen.has(pr.id)) { seen.add(pr.id); uniq.push(pr); } }
    return uniq;
  }, [programs]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Header (match Reports page style) */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" color="primary.main">
            Coordinator Dashboard
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Work from Script and To Do across active programs.
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ py: 2 }}>
          {/* Summary Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3, alignItems: 'center' }}>
            <Card sx={{ borderTop: theme => `4px solid ${theme.palette.error.main}` }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" variant="body2">Late Tasks</Typography>
                    <Typography variant="h4" color="error.main">{metrics?.lateTasks ?? 0}</Typography>
                  </Box>
                  <NotificationsActiveIcon color="error" sx={{ fontSize: 36 }} />
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" variant="body2">Tasks Due Today</Typography>
                    <Typography variant="h4" color="primary.main">{metrics?.tasksDueToday ?? 0}</Typography>
                  </Box>
                  <TodayIcon color="primary" sx={{ fontSize: 36 }} />
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" variant="body2">Appointments Today</Typography>
                    <Typography variant="h4" color="secondary.main">{metrics?.apptsDueToday ?? 0}</Typography>
                  </Box>
                  <EventAvailableIcon color="secondary" sx={{ fontSize: 36 }} />
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" variant="body2">Program Changes (This Week)</Typography>
                    <Typography variant="h4">{metrics?.programChangesThisWeek ?? 0}</Typography>
                  </Box>
                  <AutoGraphIcon sx={{ fontSize: 36 }} />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </CardContent>
      </Card>

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
                onChange={(e) => setMemberFilter(e.target.value ? Number(e.target.value) : null)}
                size="small"
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">All Members</MenuItem>
                {memberOptions.map(m => (
                  <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Date Range"
                value={range}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setRange(val);
                  if (val === 'custom') {
                    const today = new Date();
                    const iso = today.toISOString().slice(0,10);
                    setStart(prev => prev || iso);
                    setEnd(prev => prev || iso);
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
                    onChange={(e) => setStart(e.target.value || null)}
                    size="small"
                  />
                  <TextField
                    type="date"
                    label="End"
                    value={end || ''}
                    onChange={(e) => setEnd(e.target.value || null)}
                    size="small"
                  />
                </>
              )}
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
            <Tab icon={<AssignmentTurnedInIcon />} iconPosition="start" label="To Do" />
            <Tab icon={<AutoGraphIcon />} iconPosition="start" label="Program Changes" />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {tab === 0 && (
              <CoordinatorScriptTab
                memberId={memberFilter}
                range={range}
                {...(start ? { start } : {})}
                {...(end ? { end } : {})}
              />
            )}
            {tab === 1 && (
              <CoordinatorToDoTab
                memberId={memberFilter}
                range={range}
                {...(start ? { start } : {})}
                {...(end ? { end } : {})}
              />
            )}
            {tab === 2 && (
              <ProgramChangesTab
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


