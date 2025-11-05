'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  TextField,
  CircularProgress,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { toast } from 'sonner';
import { ExportOptions } from '@/lib/validations/report-export';

interface ExportReportModalProps {
  open: boolean;
  onClose: () => void;
  memberId: number;
  memberName: string;
}

export default function ExportReportModal({
  open,
  onClose,
  memberId,
  memberName,
}: ExportReportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<Partial<ExportOptions>>({
    memberId,
    format: 'pdf',
    sections: {
      memberProgress: true,
      msqAssessment: false,
      promisAssessment: false,
    },
    includeCharts: true,
    includeInterpretation: true,
    delivery: 'download',
  });

  // Update memberId when prop changes
  useEffect(() => {
    setExportOptions(prev => ({
      ...prev,
      memberId,
    }));
  }, [memberId]);

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const response = await fetch('/api/report-card/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportOptions),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Report-Card-${memberName.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Report exported successfully!');
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to export report'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Report Card</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3, mt: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Exporting report for: <strong>{memberName}</strong>
          </Typography>
        </Box>

        {/* Sections to Include */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Sections to Include
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.sections?.memberProgress}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      sections: {
                        ...exportOptions.sections!,
                        memberProgress: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="Member Progress"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.sections?.msqAssessment}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      sections: {
                        ...exportOptions.sections!,
                        msqAssessment: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="MSQ Assessment"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.sections?.promisAssessment}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      sections: {
                        ...exportOptions.sections!,
                        promisAssessment: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="PROMIS-29 Assessment"
            />
          </FormGroup>
        </Box>

        {/* Options */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Options
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.includeCharts}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      includeCharts: e.target.checked,
                    })
                  }
                  disabled
                />
              }
              label="Include Charts and Visualizations (Phase 2)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.includeInterpretation}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      includeInterpretation: e.target.checked,
                    })
                  }
                  disabled
                />
              }
              label="Include Interpretation Guides (Phase 2)"
            />
          </FormGroup>
        </Box>

        {/* Delivery Method */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Delivery
          </Typography>
          <RadioGroup
            value={exportOptions.delivery}
            onChange={(e) =>
              setExportOptions({
                ...exportOptions,
                delivery: e.target.value as 'download' | 'email',
              })
            }
          >
            <FormControlLabel
              value="download"
              control={<Radio />}
              label="Download to my computer"
            />
            <FormControlLabel
              value="email"
              control={<Radio />}
              label="Email to member (Coming in Phase 3)"
              disabled
            />
          </RadioGroup>
          {exportOptions.delivery === 'email' && (
            <TextField
              fullWidth
              size="small"
              label="Recipient Email"
              type="email"
              value={exportOptions.recipientEmail || ''}
              onChange={(e) =>
                setExportOptions({
                  ...exportOptions,
                  recipientEmail: e.target.value,
                })
              }
              sx={{ mt: 2 }}
              disabled
            />
          )}
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            Available Sections
          </Typography>
          <Typography variant="caption">
            • Member Progress Dashboard<br/>
            • MSQ Clinical Assessment<br/>
            • PROMIS-29 Health Assessment<br/>
            Coming soon: Charts and email delivery
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={
            isExporting ||
            !Object.values(exportOptions.sections || {}).some((v) => v)
          }
          startIcon={isExporting && <CircularProgress size={16} />}
        >
          {isExporting ? 'Generating PDF...' : 'Export PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

