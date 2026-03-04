'use client';

import React, { Suspense, useMemo } from 'react';
import {
  Box,
  Skeleton,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  People as PeopleIcon,
  EventBusy as EventBusyIcon,
  SpeakerNotesOff as SpeakerNotesOffIcon,
  EventAvailable as EventAvailableIcon,
} from '@mui/icons-material';
import { useLeads } from '@/lib/hooks/use-leads';
import LeadTable from '@/components/leads/lead-table';

function LeadTableSkeleton() {
  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton
          variant="rectangular"
          width={150}
          height={40}
          sx={{ borderRadius: 1 }}
        />
      </Box>
      <Box sx={{ height: 'calc(100vh - 120px)', width: '100%', flex: 1 }}>
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          sx={{ borderRadius: 1 }}
        />
      </Box>
    </Box>
  );
}

export default function LeadsPage() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();

  // Card 1: Count of leads with status "PME Scheduled" (status_id=2) but no PME date
  const noPmeDateCount = useMemo(() => {
    return leads.filter(
      (lead) => lead.status_id === 2 && !lead.pmedate
    ).length;
  }, [leads]);

  // Card 2: Count of leads with status "Follow Up" (status_id=11) but no follow-up note
  const noFollowUpNoteCount = useMemo(() => {
    return leads.filter(
      (lead: any) => lead.status_id === 11 && !lead.last_followup_note
    ).length;
  }, [leads]);

  // Card 3: Count of PMEs scheduled in the current month (pmedate in this month)
  const pmesScheduledThisMonth = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return leads.filter((lead) => {
      if (!lead.pmedate) return false;
      const dateStr = lead.pmedate.split('T')[0]; // YYYY-MM-DD
      if (!dateStr) return false;
      const parts = dateStr.split('-').map(Number);
      const y = parts[0] ?? 0;
      const m = parts[1] ?? 0;
      return y === currentYear && m === currentMonth + 1; // month is 1-based in date strings
    }).length;
  }, [leads]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
        >
          Leads
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Card 1: No PME Date */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.warning.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
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
                    No PME Date
                  </Typography>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'warning.main',
                      mt: 1,
                    }}
                  >
                    {leadsLoading ? (
                      <CircularProgress size={28} />
                    ) : (
                      noPmeDateCount
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'warning.main',
                    opacity: 0.8,
                  }}
                >
                  <EventBusyIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                PMEs with no PME date
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: No Follow-Up Note */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.error.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
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
                    No Follow-Up Note
                  </Typography>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'error.main',
                      mt: 1,
                    }}
                  >
                    {leadsLoading ? (
                      <CircularProgress size={28} />
                    ) : (
                      noFollowUpNoteCount
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'error.main',
                    opacity: 0.8,
                  }}
                >
                  <SpeakerNotesOffIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                Follow Up with no Follow-Up instructions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: PMEs Scheduled (current month) */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.info.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
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
                    PMEs Scheduled
                  </Typography>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'info.main',
                      mt: 1,
                    }}
                  >
                    {leadsLoading ? (
                      <CircularProgress size={28} />
                    ) : (
                      pmesScheduledThisMonth
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'info.main',
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
                PMEs scheduled in the current month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 4: Placeholder */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: theme => `4px solid ${theme.palette.success.main}`,
              transition:
                'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
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
                    Card 4 Title
                  </Typography>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: 'success.main',
                      mt: 1,
                    }}
                  >
                    0
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
                Card 4 helper text
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Grid */}
      <Card>
        <CardContent>
          <Suspense fallback={<LeadTableSkeleton />}>
            <LeadTable title="" />
          </Suspense>
        </CardContent>
      </Card>
    </Box>
  );
}
