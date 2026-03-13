'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TEMPLATES_QUERY_KEY } from './template-table';
import {
  useMetricDefinitions,
  type PeriodType,
} from '@/lib/hooks/use-metric-definitions';
import { toast } from 'sonner';

interface ApplyTemplateDialogProps {
  open: boolean;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ApplyTemplateDialog({ open, onClose }: ApplyTemplateDialogProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [overwrite, setOverwrite] = useState(false);

  const queryClient = useQueryClient();
  const { data: metrics = [] } = useMetricDefinitions();

  const { data: templateItems = [] } = useQuery({
    queryKey: [TEMPLATES_QUERY_KEY],
    queryFn: async () => {
      const res = await fetch('/api/operations/target-templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const json = await res.json();
      return (json.data || []) as Array<{
        id: number;
        metric_key: string;
        period_type: PeriodType;
        target_value: number;
        notes: string | null;
      }>;
    },
  });

  const monthlyCount = templateItems.filter((t) => t.period_type === 'MONTH').length;
  const weeklyCount = templateItems.filter((t) => t.period_type === 'WEEK').length;

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/operations/targets/apply-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: 'Default',
          year,
          month,
          overwrite,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      return res.json();
    },
    onSuccess: (result) => {
      const { created, skipped } = result.data;
      queryClient.invalidateQueries({ queryKey: ['operations-targets'] });
      toast.success(
        `Applied template to ${MONTHS[month - 1]} ${year}: ${created} target${created !== 1 ? 's' : ''} created${skipped ? `, ${skipped} skipped (already exist)` : ''}`
      );
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Failed to apply template: ${err.message}`);
    },
  });

  const years = useMemo(() => {
    const result: number[] = [];
    for (let y = currentYear - 1; y <= currentYear + 3; y++) result.push(y);
    return result;
  }, [currentYear]);

  const isEmpty = templateItems.length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Apply Template
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isEmpty ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No template entries defined. Add entries in the Templates tab first.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This will create targets for the selected month using your template values.
              Monthly targets are created for the month, and weekly targets are created for
              each week whose Monday falls within that month.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                select
                label="Month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                fullWidth
              >
                {MONTHS.map((name, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                sx={{ minWidth: 120 }}
              >
                {years.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Preview
            </Typography>
            <Box sx={{ mb: 2 }}>
              {monthlyCount > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {monthlyCount} monthly target{monthlyCount !== 1 ? 's' : ''} for{' '}
                  {MONTHS[month - 1]} {year}
                </Typography>
              )}
              {weeklyCount > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {weeklyCount} weekly target{weeklyCount !== 1 ? 's' : ''} for each week
                  in {MONTHS[month - 1]} (typically 4–5 weeks)
                </Typography>
              )}
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  Overwrite existing targets for this period
                </Typography>
              }
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => applyMutation.mutate()}
          disabled={isEmpty || applyMutation.isPending}
          startIcon={applyMutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {applyMutation.isPending ? 'Applying...' : 'Apply Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
