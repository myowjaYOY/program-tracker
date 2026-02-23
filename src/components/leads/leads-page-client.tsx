'use client';

import React, { useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  EventBusy as EventBusyIcon,
  SpeakerNotesOff as SpeakerNotesOffIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import LeadTable from '@/components/leads/lead-table';
import { useLeads } from '@/lib/hooks/use-leads';
import type { LeadWithMetadata } from '@/lib/data/leads';
import { Leads } from '@/types/database.types';

interface LeadsPageClientProps {
  initialLeads: LeadWithMetadata[];
}

// Convert LeadWithMetadata to LeadEntity format expected by LeadTable
function convertToLeadEntity(lead: LeadWithMetadata): any {
  return {
    ...lead,
    id: lead.lead_id,
    created_at: lead.created_at || new Date().toISOString(),
    updated_at: lead.updated_at || new Date().toISOString(),
    created_by: lead.created_by_email || '-',
    updated_by: lead.updated_by_email || '-',
  };
}

/**
 * Client component that receives pre-fetched data from Server Component
 * Uses React Query for client-side updates and refetching
 */
export default function LeadsPageClient({ initialLeads }: LeadsPageClientProps) {
  // Use React Query for data management, using SSR data as initial state
  const { data: leads = initialLeads, isLoading } = useLeads({
    initialData: initialLeads
  });

  // Calculate metrics from current data
  const noPmeDateCount = useMemo(() => {
    return leads.filter(
      (lead: LeadWithMetadata) => lead.status_id === 2 && !lead.pmedate
    ).length;
  }, [leads]);

  const noFollowUpNoteCount = useMemo(() => {
    return leads.filter(
      (lead: LeadWithMetadata) => lead.status_id === 11 && !lead.last_followup_note
    ).length;
  }, [leads]);

  return (
    <Box sx={{ p: 0 }}>
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
                    {isLoading ? <CircularProgress size={24} color="warning" /> : noPmeDateCount}
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
                    {isLoading ? <CircularProgress size={24} color="error" /> : noFollowUpNoteCount}
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

        {/* Card 3: Placeholder */}
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
                    Card 3 Title
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
                    0
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'warning.main',
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
                Card 3 helper text
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
          <LeadTable
            title=""
            initialData={leads.map(convertToLeadEntity)}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
