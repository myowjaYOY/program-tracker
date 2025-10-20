'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SummaryCards from '@/components/report-card/SummaryCards';
import MsqAssessmentTab from '@/components/report-card/MsqAssessmentTab';
import { useReportCardSummary, useReportCardParticipants } from '@/lib/hooks/use-report-card';
import { LeadNotesModal } from '@/components/notes';

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
      id={`report-card-tabpanel-${index}`}
      aria-labelledby={`report-card-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ReportCardPage() {
  const [tabValue, setTabValue] = useState(0);
  const [programId, setProgramId] = useState<number | undefined>(undefined);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  
  // Notes modal state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);

  // Fetch summary data
  const { data: summary, isLoading: summaryLoading } = useReportCardSummary(programId);
  
  // Fetch members for dropdown
  const { data: membersData, isLoading: membersLoading } = useReportCardParticipants();
  
  // Sort members alphabetically by full_name
  const members = React.useMemo(() => {
    if (!membersData) return [];
    return [...membersData].sort((a, b) => 
      a.full_name.localeCompare(b.full_name)
    );
  }, [membersData]);
  
  // Get selected member details
  const selectedMember = React.useMemo(() => {
    if (!selectedMemberId || !members) return null;
    return members.find(m => m.external_user_id === selectedMemberId) || null;
  }, [selectedMemberId, members]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleOpenNotesModal = () => {
    if (selectedMemberId) {
      setIsNotesModalOpen(true);
    }
  };

  const handleCloseNotesModal = () => {
    setIsNotesModalOpen(false);
  };

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
          Report Card
        </Typography>
      </Box>

      {/* Summary Cards */}
      <SummaryCards data={summary} isLoading={summaryLoading} />

      {/* Member Filter - Above Tabs */}
      <Grid container spacing={2} sx={{ mt: 4, mb: 3 }} alignItems="center">
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="member-select-label">Member *</InputLabel>
            <Select
              labelId="member-select-label"
              id="member-select"
              value={selectedMemberId ?? ''}
              label="Member *"
              onChange={(e) => {
                const value = e.target.value;
                setSelectedMemberId(value ? Number(value) : null);
              }}
              required
              disabled={membersLoading}
            >
              <MenuItem value="">
                <em>Select a Member</em>
              </MenuItem>
              {members?.map((member) => (
                <MenuItem
                  key={member.external_user_id}
                  value={member.external_user_id}
                >
                  {member.full_name} ({member.survey_count} MSQ {member.survey_count === 1 ? 'survey' : 'surveys'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size="auto">
          <Tooltip title={
            selectedMember?.lead_id 
              ? `View/Add Notes for ${selectedMember.full_name}` 
              : selectedMemberId 
                ? 'This member is not linked to a lead record'
                : 'Select a member to add notes'
          }>
            <span>
              <IconButton
                onClick={handleOpenNotesModal}
                disabled={!selectedMember?.lead_id}
                sx={{ 
                  color: selectedMember?.lead_id ? 'primary.main' : 'text.disabled',
                  '&:hover': { 
                    backgroundColor: selectedMember?.lead_id ? 'primary.50' : 'transparent',
                  },
                  '&.Mui-disabled': {
                    color: 'text.disabled',
                  }
                }}
              >
                <EditNoteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="report card tabs"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
            },
          }}
        >
          <Tab
            icon={<AssessmentIcon />}
            iconPosition="start"
            label="MSQ ASSESSMENT"
            id="report-card-tab-0"
            aria-controls="report-card-tabpanel-0"
          />
          {/* Future tabs: PROMIS-29, Timeline, etc. */}
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <MsqAssessmentTab selectedMemberId={selectedMemberId} />
      </TabPanel>
      
      {/* Lead Notes Modal */}
      {selectedMember && selectedMember.lead_id && (
        <LeadNotesModal
          open={isNotesModalOpen}
          onClose={handleCloseNotesModal}
          leadId={selectedMember.lead_id}
          leadName={selectedMember.full_name}
        />
      )}
    </Box>
  );
}

