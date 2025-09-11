'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  CardHeader, 
  Typography,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import {
  Description as DescriptionIcon,
  AttachMoney as AttachMoneyIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import ProgramsGrid from '@/components/programs/programs-grid';
import ProgramInfoTab from '@/components/programs/program-info-tab';
import ProgramFinancialsTab from '@/components/programs/program-financials-tab';
import ProgramItemsTab from '@/components/programs/program-items-tab';
import ProgramTasksTab from '@/components/programs/program-tasks-tab';
import { MemberPrograms } from '@/types/database.types';
import { useUpdateMemberProgram } from '@/lib/hooks/use-member-programs';

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
      id={`program-tabpanel-${index}`}
      aria-labelledby={`program-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function ProgramsPage() {
  const [selectedProgram, setSelectedProgram] = useState<MemberPrograms | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState<number | null>(null);
  const updateProgram = useUpdateMemberProgram();

  const handleProgramSelect = (program: MemberPrograms | null) => {
    console.log('Program selected:', program);
    setSelectedProgram(program);
    setTabValue(0); // Reset to first tab when selecting new program
  };

  // Debug logging for program changes
  React.useEffect(() => {
    console.log('Selected program changed:', selectedProgram);
  }, [selectedProgram]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    // If there are unsaved changes, show warning instead of changing tabs
    if (hasUnsavedChanges && tabValue === 0) {
      setPendingTabChange(newValue);
      setShowUnsavedWarning(true);
    } else {
      setTabValue(newValue);
    }
  };

  const handleProgramUpdate = async (updatedProgram: MemberPrograms) => {
    try {
      // Call the API to update the program
      await updateProgram.mutateAsync({
        id: updatedProgram.member_program_id.toString(),
        data: {
          program_template_name: updatedProgram.program_template_name,
          description: updatedProgram.description,
          lead_id: updatedProgram.lead_id,
          start_date: updatedProgram.start_date,
          program_status_id: updatedProgram.program_status_id,
          active_flag: updatedProgram.active_flag,
        }
      });
      
      // Update local state after successful API call
      setSelectedProgram(updatedProgram);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to update program:', error);
      // You could add toast notification here for user feedback
    }
  };

  const handleUnsavedWarningConfirm = () => {
    // User confirmed they want to lose changes
    setHasUnsavedChanges(false);
    setShowUnsavedWarning(false);
    if (pendingTabChange !== null) {
      setTabValue(pendingTabChange);
      setPendingTabChange(null);
    }
  };

  const handleUnsavedWarningCancel = () => {
    // User cancelled, stay on current tab
    setShowUnsavedWarning(false);
    setPendingTabChange(null);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Programs Grid - matches Program Templates page exactly */}
      <Box sx={{ mb: 2 }}>
        <ProgramsGrid 
          onProgramSelect={handleProgramSelect}
          selectedProgram={selectedProgram}
        />
      </Box>

      {/* Program Details Tabs - additional functionality */}
      {selectedProgram && (
        <Box sx={{ flex: 1, minHeight: '400px', overflow: 'hidden' }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', overflow: 'auto' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange} 
                  aria-label="program tabs"
                  sx={{
                    '& .MuiTab-root': {
                      minHeight: 48,
                      paddingX: 8, // Double the previous padding (was 4)
                      marginX: 2, // Double the previous margin (was 1)
                    }
                  }}
                >
                  <Tab 
                    icon={<DescriptionIcon />} 
                    label="PROGRAM" 
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<AttachMoneyIcon />} 
                    label="Financials" 
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<InventoryIcon />} 
                    label="Items" 
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<AssignmentIcon />} 
                    label="Tasks" 
                    iconPosition="start"
                  />
                </Tabs>
              </Box>
              
              <TabPanel value={tabValue} index={0}>
                <ProgramInfoTab 
                  program={selectedProgram}
                  onProgramUpdate={handleProgramUpdate}
                  onUnsavedChangesChange={setHasUnsavedChanges}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={1}>
                <ProgramFinancialsTab 
                  program={selectedProgram}
                  onFinancesUpdate={(finances) => {
                    console.log('Finances updated:', finances);
                    // TODO: Implement finances update logic
                  }}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={2}>
                <ProgramItemsTab 
                  program={selectedProgram}
                  onProgramUpdate={(updatedProgram) => setSelectedProgram(updatedProgram)}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={3}>
                <ProgramTasksTab program={selectedProgram} />
              </TabPanel>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Unsaved Changes Warning Dialog */}
      <Dialog
        open={showUnsavedWarning}
        onClose={handleUnsavedWarningCancel}
        aria-labelledby="unsaved-changes-dialog-title"
      >
        <DialogTitle id="unsaved-changes-dialog-title">
          Unsaved Changes
        </DialogTitle>
        <DialogContent>
          You have unsaved changes on the PROGRAM tab. If you continue, these changes will be lost.
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUnsavedWarningCancel} color="primary" sx={{ borderRadius: 0 }}>
            Cancel
          </Button>
          <Button onClick={handleUnsavedWarningConfirm} color="error" variant="contained" sx={{ borderRadius: 0 }}>
            Continue (Lose Changes)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
