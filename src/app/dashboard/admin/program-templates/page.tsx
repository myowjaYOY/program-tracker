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
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import ProgramTemplatesGrid from '@/components/admin/program-templates/program-templates-grid';
import TemplateInfoTab from '@/components/admin/program-templates/template-info-tab';
import TemplateItemsTab from '@/components/admin/program-templates/template-items-tab';
import TemplateTasksTab from '@/components/admin/program-templates/template-tasks-tab';
import { ProgramTemplate } from '@/types/database.types';
import { useUpdateProgramTemplate } from '@/lib/hooks/use-program-templates';

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
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
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

export default function ProgramTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState<number | null>(null);
  const updateTemplate = useUpdateProgramTemplate();

  const handleTemplateSelect = (template: ProgramTemplate | null) => {
    console.log('Template selected:', template);
    setSelectedTemplate(template);
    setTabValue(0); // Reset to first tab when selecting new template
  };

  // Debug logging for template changes
  React.useEffect(() => {
    console.log('Selected template changed:', selectedTemplate);
  }, [selectedTemplate]);



  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    // If there are unsaved changes, show warning instead of changing tabs
    if (hasUnsavedChanges && tabValue === 0) {
      setPendingTabChange(newValue);
      setShowUnsavedWarning(true);
    } else {
      setTabValue(newValue);
    }
  };

  const handleTemplateUpdate = async (updatedTemplate: ProgramTemplate) => {
    try {
      // Call the API to update the template
      await updateTemplate.mutateAsync({
        id: updatedTemplate.program_template_id,
        data: {
          program_template_name: updatedTemplate.program_template_name,
          description: updatedTemplate.description,
          active_flag: updatedTemplate.active_flag,
        }
      });
      
      // Update local state after successful API call
      setSelectedTemplate(updatedTemplate);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to update template:', error);
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
      {/* Templates Grid - matches Vendors page exactly */}
      <Box sx={{ mb: 2 }}>
        <ProgramTemplatesGrid 
          onTemplateSelect={handleTemplateSelect}
          selectedTemplate={selectedTemplate}
        />
      </Box>

      {/* Template Details Tabs - additional functionality */}
      {selectedTemplate && (
        <Box sx={{ flex: 1, minHeight: '400px', overflow: 'hidden' }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', overflow: 'auto' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange} 
                  aria-label="template tabs"
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
                    label="TEMPLATE" 
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
                <TemplateInfoTab 
                  template={selectedTemplate}
                  onTemplateUpdate={handleTemplateUpdate}
                  onUnsavedChangesChange={setHasUnsavedChanges}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={1}>
                <TemplateItemsTab 
                  template={selectedTemplate}
                  onTemplateUpdate={(updatedTemplate) => setSelectedTemplate(updatedTemplate)}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={2}>
                <TemplateTasksTab template={selectedTemplate} />
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
          You have unsaved changes on the TEMPLATE tab. If you continue, these changes will be lost.
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
