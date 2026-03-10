'use client';

import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import {
    Description as DescriptionIcon,
    AttachMoney as AttachMoneyIcon,
    Inventory as InventoryIcon,
    Assignment as AssignmentIcon,
    Payment as PaymentIcon,
    AssignmentTurnedIn as AssignmentTurnedInIcon,
    List as ListIcon,
} from '@mui/icons-material';
import ProgramsGrid from '@/components/programs/programs-grid';
import ProgramInfoTab from '@/components/programs/program-info-tab';
import ProgramFinancialsTab from '@/components/programs/program-financials-tab';
import ProgramItemsTab from '@/components/programs/program-items-tab';
import ProgramTasksTab from '@/components/programs/program-tasks-tab';
import ProgramToDoTab from '@/components/programs/program-todo-tab';
import ProgramScriptTab from '@/components/programs/program-script-tab';
import ProgramPaymentsTab from '@/components/programs/program-payments-tab';
import MemberProgramRashaTab from '@/components/programs/member-program-rasha-tab';
import TabPanel, { a11yProps } from '@/components/ui/TabPanel';
import { MemberPrograms } from '@/types/database.types';
import { useUpdateMemberProgram } from '@/lib/hooks/use-member-programs';

interface ProgramsPageClientProps {
    initialPrograms: MemberPrograms[];
}

export default function ProgramsPageClient({ initialPrograms }: ProgramsPageClientProps) {
    const [selectedProgram, setSelectedProgram] = useState<MemberPrograms | null>(null);
    const [tabValue, setTabValue] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [pendingTabChange, setPendingTabChange] = useState<number | null>(null);
    const updateProgram = useUpdateMemberProgram();

    const handleProgramSelect = (program: MemberPrograms | null) => {
        setSelectedProgram(program);
        setTabValue(0);
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        if (hasUnsavedChanges) {
            setPendingTabChange(newValue);
            setShowUnsavedWarning(true);
        } else {
            setTabValue(newValue);
        }
    };

    const handleProgramUpdate = async (updatedProgram: MemberPrograms) => {
        try {
            await updateProgram.mutateAsync({
                id: updatedProgram.member_program_id.toString(),
                data: {
                    program_template_name: updatedProgram.program_template_name,
                    description: updatedProgram.description,
                    lead_id: updatedProgram.lead_id,
                    start_date: updatedProgram.start_date,
                    duration: updatedProgram.duration,
                    program_status_id: updatedProgram.program_status_id,
                    active_flag: updatedProgram.active_flag,
                },
            });
            setSelectedProgram(updatedProgram);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Failed to update program:', error);
        }
    };

    const handleUnsavedWarningConfirm = () => {
        setHasUnsavedChanges(false);
        setShowUnsavedWarning(false);
        if (pendingTabChange !== null) {
            setTabValue(pendingTabChange);
            setPendingTabChange(null);
        }
    };

    const handleUnsavedWarningCancel = () => {
        setShowUnsavedWarning(false);
        setPendingTabChange(null);
    };

    return (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 2 }}>
                <ProgramsGrid
                    onProgramSelect={handleProgramSelect}
                    selectedProgram={selectedProgram}
                    initialData={initialPrograms}
                />
            </Box>

            {selectedProgram && (
                <Box sx={{ flex: 1, minHeight: '400px', overflow: 'hidden' }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ height: '100%', overflow: 'auto' }}>
                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tabs
                                    value={tabValue}
                                    onChange={handleTabChange}
                                    aria-label="program tabs"
                                    variant="scrollable"
                                    scrollButtons="auto"
                                    sx={{
                                        '& .MuiTab-root': {
                                            minHeight: 44,
                                            paddingX: 4,
                                            marginX: 1,
                                        },
                                    }}
                                >
                                    <Tab icon={<DescriptionIcon />} label="PROGRAM" iconPosition="start" {...a11yProps('program', 0)} />
                                    <Tab icon={<AttachMoneyIcon />} label="Financials" iconPosition="start" {...a11yProps('program', 1)} />
                                    <Tab icon={<PaymentIcon />} label="Payments" iconPosition="start" {...a11yProps('program', 2)} />
                                    <Tab icon={<InventoryIcon />} label="Items" iconPosition="start" {...a11yProps('program', 3)} />
                                    <Tab icon={<AssignmentIcon />} label="Tasks" iconPosition="start" {...a11yProps('program', 4)} />
                                    <Tab icon={<AssignmentTurnedInIcon />} label="Script" iconPosition="start" {...a11yProps('program', 5)} />
                                    <Tab icon={<AssignmentIcon />} label="To Do" iconPosition="start" {...a11yProps('program', 6)} />
                                    <Tab icon={<ListIcon />} label="RASHA" iconPosition="start" {...a11yProps('program', 7)} />
                                </Tabs>
                            </Box>

                            <TabPanel value={tabValue} index={0} idPrefix="program">
                                <ProgramInfoTab
                                    program={selectedProgram}
                                    onProgramUpdate={handleProgramUpdate}
                                    onUnsavedChangesChange={setHasUnsavedChanges}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={1} idPrefix="program">
                                <ProgramFinancialsTab
                                    program={selectedProgram}
                                    onFinancesUpdate={() => { }}
                                    onUnsavedChangesChange={setHasUnsavedChanges}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={2} idPrefix="program">
                                <ProgramPaymentsTab program={selectedProgram} />
                            </TabPanel>

                            <TabPanel value={tabValue} index={3} idPrefix="program">
                                <ProgramItemsTab
                                    program={selectedProgram}
                                    onProgramUpdate={setSelectedProgram}
                                    onUnsavedChangesChange={setHasUnsavedChanges}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={4} idPrefix="program">
                                <ProgramTasksTab program={selectedProgram} />
                            </TabPanel>

                            <TabPanel value={tabValue} index={5} idPrefix="program">
                                <ProgramScriptTab program={selectedProgram} />
                            </TabPanel>

                            <TabPanel value={tabValue} index={6} idPrefix="program">
                                <ProgramToDoTab program={selectedProgram} />
                            </TabPanel>

                            <TabPanel value={tabValue} index={7} idPrefix="program">
                                <MemberProgramRashaTab program={selectedProgram} />
                            </TabPanel>
                        </CardContent>
                    </Card>
                </Box>
            )}

            <Dialog
                open={showUnsavedWarning}
                onClose={handleUnsavedWarningCancel}
                aria-labelledby="unsaved-changes-dialog-title"
            >
                <DialogTitle id="unsaved-changes-dialog-title">Unsaved Changes</DialogTitle>
                <DialogContent>
                    You have unsaved changes. If you continue, these changes will be lost.
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleUnsavedWarningCancel} color="primary">Cancel</Button>
                    <Button onClick={handleUnsavedWarningConfirm} color="error" variant="contained">Continue (Lose Changes)</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}