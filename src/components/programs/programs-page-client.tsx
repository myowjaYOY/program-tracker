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
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

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

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
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
                                    sx={{
                                        '& .MuiTab-root': {
                                            minHeight: 44,
                                            paddingX: 4,
                                            marginX: 1,
                                        },
                                    }}
                                >
                                    <Tab icon={<DescriptionIcon />} label="PROGRAM" iconPosition="start" />
                                    <Tab icon={<AttachMoneyIcon />} label="Financials" iconPosition="start" />
                                    <Tab icon={<PaymentIcon />} label="Payments" iconPosition="start" />
                                    <Tab icon={<InventoryIcon />} label="Items" iconPosition="start" />
                                    <Tab icon={<AssignmentIcon />} label="Tasks" iconPosition="start" />
                                    <Tab icon={<AssignmentTurnedInIcon />} label="Script" iconPosition="start" />
                                    <Tab icon={<AssignmentIcon />} label="To Do" iconPosition="start" />
                                    <Tab icon={<ListIcon />} label="RASHA" iconPosition="start" />
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
                                    onFinancesUpdate={() => { }}
                                    onUnsavedChangesChange={setHasUnsavedChanges}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={2}>
                                <ProgramPaymentsTab program={selectedProgram} />
                            </TabPanel>

                            <TabPanel value={tabValue} index={3}>
                                <ProgramItemsTab
                                    program={selectedProgram}
                                    onProgramUpdate={setSelectedProgram}
                                    onUnsavedChangesChange={setHasUnsavedChanges}
                                />
                            </TabPanel>

                            <TabPanel value={tabValue} index={4}>
                                <ProgramTasksTab program={selectedProgram} />
                            </TabPanel>
                            <TabPanel value={tabValue} index={5}>
                                <ProgramScriptTab program={selectedProgram} />
                            </TabPanel>
                            <TabPanel value={tabValue} index={6}>
                                <ProgramToDoTab program={selectedProgram} />
                            </TabPanel>
                            <TabPanel value={tabValue} index={7}>
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
