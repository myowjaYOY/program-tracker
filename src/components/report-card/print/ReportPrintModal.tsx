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
    GlobalStyles,
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

/**
 * Global print styles injected when the modal is open.
 * Sets A4 paper size and scales content to 127% so the report
 * fills the page properly when the user clicks "Proceed to Print".
 */
const printGlobalStyles = (
    <GlobalStyles
        styles={{
            '@media print': {
                '@page': {
                    size: 'A4 portrait',
                    margin: '0mm',
                },
                'html, body': {
                    margin: '0 !important',
                    padding: '0 !important',
                    width: '210mm !important',
                    minHeight: '297mm !important',
                    overflow: 'visible !important',
                    backgroundColor: '#ffffff !important',
                },
                // Scale the printable content to 127% to fill A4 properly
                '.printable-content': {
                    transform: 'scale(1.27)',
                    transformOrigin: 'top left',
                    width: `${100 / 1.27}%`, // ~78.74% so scaled output = 100%
                },
                // Hide all non-print elements
                '.MuiDialogTitle-root, .MuiDialogActions-root, .MuiDialog-container > .MuiPaper-root > :not(.MuiDialogContent-root)': {
                    display: 'none !important',
                },
                '.MuiDialog-root': {
                    position: 'static !important',
                },
                '.MuiDialog-container': {
                    display: 'block !important',
                },
                '.MuiPaper-root.MuiDialog-paper': {
                    margin: '0 !important',
                    maxHeight: 'none !important',
                    maxWidth: 'none !important',
                    boxShadow: 'none !important',
                    borderRadius: '0 !important',
                    position: 'static !important',
                    overflow: 'visible !important',
                },
                '.MuiDialogContent-root': {
                    padding: '0 !important',
                    overflow: 'visible !important',
                },
            },
        }}
    />
);

export default function ReportPrintModal({
    open,
    onClose,
    memberName,
    reportData,
    sections,
}: ReportPrintModalProps) {
    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            {/* Inject print styles only when modal is open */}
            {open && printGlobalStyles}

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
                                // Preview uses A4 width (210mm ≈ 8.27in) for accurate on-screen representation
                                width: '210mm',
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
                        Tip: For best results, set paper size to &quot;A4&quot;, margins to &quot;None&quot;, and scale to &quot;127&quot; in print settings. Enable &quot;Background graphics&quot;.
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
        </>
    );
}