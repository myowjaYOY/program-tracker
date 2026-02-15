'use client';

import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { printStyles } from './print-styles';
import PrintReportLayout from './PrintReportLayout';
import PrintHeader from './PrintHeader';
import PrintMemberProgress from './PrintMemberProgress';
import PrintMsqAssessment from './PrintMsqAssessment';
import PrintPromisAssessment from './PrintPromisAssessment';

interface ReportPrintPreviewProps {
    reportData: any;
    sections: {
        memberProgress: boolean;
        msqAssessment: boolean;
        promisAssessment: boolean;
    };
}

export default function ReportPrintPreview({
    reportData,
    sections,
}: ReportPrintPreviewProps) {
    if (!reportData) {
        return (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <Box sx={printStyles.page} className="printable-content">
            <PrintReportLayout
                memberName={reportData.member?.name || 'Member'}
                reportDate={reportDate}
            >
                {/* Member Progress Section */}
                {sections.memberProgress && (
                    <>
                        {reportData.memberProgress ? (
                            <PrintMemberProgress data={reportData.memberProgress} />
                        ) : (
                            <Box sx={{ mb: 4, p: 3, bgcolor: '#fff3cd', borderLeft: '4px solid #ffc107', borderRadius: '4px' }}>
                                <Typography sx={{ fontWeight: 600, color: '#856404', fontSize: '14px' }}>
                                    Member Progress Data Not Available
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#856404' }}>
                                    Dashboard data will be available after the member completes their first survey import.
                                </Typography>
                            </Box>
                        )}
                    </>
                )}

                {/* MSQ Assessment Section */}
                {sections.msqAssessment && (
                    <>
                        {reportData.msqAssessment ? (
                            <PrintMsqAssessment
                                data={reportData.msqAssessment}
                                isFirstSection={!sections.memberProgress}
                            />
                        ) : (
                            <Box sx={{
                                mb: 4,
                                ...(sections.memberProgress ? printStyles.pageBreakBefore : {})
                            }}>
                                <Typography variant="h6" sx={printStyles.sectionTitle}>
                                    MSQ Clinical Assessment
                                </Typography>
                                <Box sx={{ p: 3, bgcolor: '#fff3cd', borderLeft: '4px solid #ffc107', borderRadius: '4px' }}>
                                    <Typography sx={{ fontWeight: 600, color: '#856404', fontSize: '14px' }}>
                                        MSQ Assessment Data Not Available
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </>
                )}

                {/* PROMIS Assessment Section */}
                {sections.promisAssessment && (
                    <>
                        {reportData.promisAssessment ? (
                            <PrintPromisAssessment
                                data={reportData.promisAssessment}
                                isFirstSection={!sections.memberProgress && !sections.msqAssessment}
                            />
                        ) : (
                            <Box sx={{
                                mb: 4,
                                ...((sections.memberProgress || sections.msqAssessment) ? printStyles.pageBreakBefore : {})
                            }}>
                                <Typography variant="h6" sx={printStyles.sectionTitle}>
                                    PROMIS-29 Health Assessment
                                </Typography>
                                <Box sx={{ p: 3, bgcolor: '#fff3cd', borderLeft: '4px solid #ffc107', borderRadius: '4px' }}>
                                    <Typography sx={{ fontWeight: 600, color: '#856404', fontSize: '14px' }}>
                                        PROMIS-29 Assessment Data Not Available
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </>
                )}
            </PrintReportLayout>
        </Box>
    );
}
