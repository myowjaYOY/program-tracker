'use client';

import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    IconButton,
    Tooltip,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';
import ReportPrintPreview from './ReportPrintPreview';

interface ReportPrintModalProps {
    open: boolean;
    onClose: () => void;
    memberName: string;
    reportData: any;
    sections: {
        memberProgress: boolean;
        msqAssessment: boolean;
        promisAssessment: boolean;
    };
}

export default function ReportPrintModal({
    open,
    onClose,
    memberName,
    reportData,
    sections,
}: ReportPrintModalProps) {
    const handlePrint = () => {
        // Basic browser print trigger
        window.print();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            scroll="paper"
            PaperProps={{
                sx: {
                    bgcolor: '#f1f5f9',
                    '@media print': {
                        bgcolor: '#ffffff',
                        boxShadow: 'none',
                    },
                },
            }}
        >
            <DialogTitle
                sx={{
                    m: 0,
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: '#ffffff',
                    borderBottom: '1px solid #e2e8f0',
                    '@media print': { display: 'none' },
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" component="div">
                        Report Preview: {memberName}
                    </Typography>
                    <Box
                        sx={{
                            bgcolor: 'primary.main',
                            color: 'white',
                            px: 1,
                            py: 0.2,
                            borderRadius: 1,
                            fontSize: '10px',
                            fontWeight: 700,
                        }}
                    >
                        HIGH FIDELITY
                    </Box>
                </Box>
                <Box>
                    <Tooltip title="Print Report">
                        <Button
                            variant="contained"
                            startIcon={<PrintIcon />}
                            onClick={handlePrint}
                            sx={{ mr: 2, borderRadius: 2 }}
                        >
                            Print to PDF
                        </Button>
                    </Tooltip>
                    <IconButton onClick={onClose} aria-label="close">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent
                sx={{
                    p: 0,
                    '@media print': {
                        p: 0,
                        overflow: 'visible',
                        position: 'static',
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        py: 4,
                        width: '100%',
                        '@media print': {
                            py: 0,
                            display: 'block',
                        },
                    }}
                >
                    <Box
                        sx={{
                            bgcolor: '#ffffff',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                            width: '8.5in',
                            '@media print': {
                                boxShadow: 'none',
                                width: '100%',
                                margin: 0,
                                padding: 0,
                            },
                        }}
                    >
                        <ReportPrintPreview reportData={reportData} sections={sections} />
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions
                sx={{
                    borderTop: '1px solid #e2e8f0',
                    p: 2,
                    bgcolor: '#ffffff',
                    '@media print': { display: 'none' },
                }}
            >
                <Typography variant="caption" color="textSecondary" sx={{ mr: 'auto', ml: 2 }}>
                    Tip: For best results, set margins to "None" in the print settings and enable "Background graphics".
                </Typography>
                <Button onClick={onClose} sx={{ px: 3 }}>
                    Close Preview
                </Button>
                <Button
                    variant="contained"
                    onClick={handlePrint}
                    startIcon={<PrintIcon />}
                    sx={{ px: 4, borderRadius: 2 }}
                >
                    Proceed to Print
                </Button>
            </DialogActions>
        </Dialog>
    );
}
