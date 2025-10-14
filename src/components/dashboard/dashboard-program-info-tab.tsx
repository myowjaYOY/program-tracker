'use client';

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import { MemberPrograms } from '@/types/database.types';
import { useActiveLeads } from '@/lib/hooks/use-leads';
import { useActiveProgramStatus } from '@/lib/hooks/use-program-status';

interface DashboardProgramInfoTabProps {
  program: MemberPrograms;
}

export default function DashboardProgramInfoTab({
  program,
}: DashboardProgramInfoTabProps) {
  const { data: leads = [] } = useActiveLeads();
  const { data: programStatuses = [] } = useActiveProgramStatus();

  // Get the current lead data
  const currentLead = leads.find(lead => lead.lead_id === program.lead_id);
  const currentStatus = programStatuses.find(
    status => status.program_status_id === program.program_status_id
  );

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* Column 1: Program Name, Member, Status, Start Date */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
          >
            {/* Program Name */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Program Name
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 500 }}>
                {program.program_template_name || 'No name set'}
              </Typography>
            </Box>

            {/* Member */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Member
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {currentLead 
                  ? `${currentLead.first_name} ${currentLead.last_name}`.trim()
                  : 'No member assigned'
                }
              </Typography>
              {currentLead?.email && (
                <Typography variant="body2" color="text.secondary">
                  {currentLead.email}
                </Typography>
              )}
            </Box>

            {/* Status */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Status
              </Typography>
              <Chip
                label={currentStatus?.status_name || 'Unknown'}
                color={
                  currentStatus?.status_name?.toLowerCase() === 'active'
                    ? 'success'
                    : currentStatus?.status_name?.toLowerCase() === 'paused'
                    ? 'warning'
                    : currentStatus?.status_name?.toLowerCase() === 'completed'
                    ? 'info'
                    : 'default'
                }
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            </Box>

            {/* Start Date */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Start Date
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {program.start_date 
                  ? new Date(program.start_date).toLocaleDateString()
                  : 'Not set'
                }
              </Typography>
            </Box>
          </Box>

          {/* Column 2: Active Flag, Description */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
          >
            {/* Active Flag */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Active Flag
              </Typography>
              <Chip
                label={program.active_flag ? 'Active' : 'Inactive'}
                color={program.active_flag ? 'success' : 'default'}
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            </Box>

            {/* Description */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Member Goals
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontWeight: 500,
                  minHeight: '120px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {program.description || 'No goals specified'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
