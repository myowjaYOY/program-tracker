'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLeads } from '@/lib/hooks/use-leads';
import { useProgramTemplates } from '@/lib/hooks/use-program-templates';
import { useActiveProgramStatus } from '@/lib/hooks/use-program-status';
import { useCreateMemberProgram } from '@/lib/hooks/use-member-programs';
import { toast } from 'sonner';

// Wizard step schemas
const step1Schema = z.object({
  lead_id: z.number().min(1, 'Please select a lead'),
});

const step2Schema = z.object({
  selected_template_ids: z.array(z.number()).min(1, 'Please select at least one program template'),
});

const step3Schema = z.object({
  program_template_name: z.string().min(1, 'Program name is required'),
  description: z.string().optional(),
});

const wizardSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type WizardFormData = z.infer<typeof wizardSchema>;

interface AddProgramWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const steps = ['Select Lead', 'Select Program Template', 'Program Details'];

export default function AddProgramWizard({
  open,
  onClose,
  onSuccess,
}: AddProgramWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [totalCharge, setTotalCharge] = useState(0);

  const { data: allLeads = [] } = useLeads();
  const { data: allProgramTemplates = [] } = useProgramTemplates();
  const { data: programStatuses = [] } = useActiveProgramStatus();

  // Filter leads: exclude Lost, UNK, or No PME status and sort by first name
  const leads = allLeads
    .filter(
      lead =>
        (lead as any).status_name &&
        !['Lost', 'UNK', 'No PME'].includes((lead as any).status_name)
    )
    .sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));

  // Filter program templates: only active ones and sort by name
  const programTemplates = allProgramTemplates
    .filter(template => template.active_flag)
    .sort((a, b) =>
      (a.program_template_name || '').localeCompare(
        b.program_template_name || ''
      )
    );
  const createProgram = useCreateMemberProgram();

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    trigger,
    reset,
  } = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    mode: 'onChange',
    defaultValues: {
      lead_id: 0,
      selected_template_ids: [],
      program_template_name: '',
      description: '',
    },
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      reset({
        lead_id: 0,
        selected_template_ids: [],
        program_template_name: '',
        description: '',
      });
      setActiveStep(0);
      setCompletedSteps(new Set());
      setSelectedTemplates([]);
      setTotalCost(0);
      setTotalCharge(0);
    }
  }, [open, reset]);

  // Calculate totals when selected templates change
  React.useEffect(() => {
    const totals = selectedTemplates.reduce((acc, templateId) => {
      const template = programTemplates.find(t => t.program_template_id === templateId);
      return {
        cost: acc.cost + (template?.total_cost || 0),
        charge: acc.charge + (template?.total_charge || 0)
      };
    }, { cost: 0, charge: 0 });
    
    setTotalCost(totals.cost);
    setTotalCharge(totals.charge);
  }, [selectedTemplates, programTemplates]);

  const handleNext = async () => {
    let isValidStep = false;

    if (activeStep === 0) {
      isValidStep = await trigger(['lead_id']);
    } else if (activeStep === 1) {
      isValidStep = await trigger(['selected_template_ids']);
    } else if (activeStep === 2) {
      isValidStep = await trigger(['program_template_name']);
    }

    if (isValidStep) {
      setCompletedSteps(prev => new Set([...prev, activeStep]));
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleClose = () => {
    setActiveStep(0);
    setCompletedSteps(new Set());
    onClose();
  };

  const onSubmit = async (data: WizardFormData) => {
    try {
      // Find the "Quote" status ID
      const quoteStatus = programStatuses.find(
        status => status.status_name.toLowerCase() === 'quote'
      );

      await createProgram.mutateAsync({
        program_template_name: data.program_template_name,
        description: data.description || '',
        lead_id: data.lead_id,
        start_date: null, // Start date is blank by default
        program_status_id: quoteStatus?.program_status_id || 1, // Default to "Quote" or fallback to first status
        selected_template_ids: data.selected_template_ids,
        // The database function will handle copying costs, charges, and margin from the templates
      } as any);

      toast.success('Program created successfully!');
      handleClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Failed to create program:', error);
      toast.error('Failed to create program');
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Select Lead
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose the lead for whom you're creating this program.
            </Typography>

            <Controller
              key={`lead_id_${activeStep}`}
              name="lead_id"
              control={control}
              render={({ field }) => {
                return (
                  <FormControl fullWidth error={!!errors.lead_id}>
                    <InputLabel>Lead</InputLabel>
                    <Select
                      label="Lead"
                      value={field.value || ''}
                      onChange={e => {
                        field.onChange(Number(e.target.value));
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                    >
                      {leads.map(lead => (
                        <MenuItem key={lead.lead_id} value={lead.lead_id}>
                          {lead.first_name} {lead.last_name} ({lead.email})
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.lead_id && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 1, display: 'block' }}
                      >
                        {errors.lead_id.message}
                      </Typography>
                    )}
                  </FormControl>
                );
              }}
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Select Program Templates
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose one or more program templates to combine into this program.
            </Typography>

            <Controller
              key={`selected_template_ids_${activeStep}`}
              name="selected_template_ids"
              control={control}
              render={({ field }) => {
                return (
                  <FormControl fullWidth error={!!errors.selected_template_ids}>
                    <InputLabel>Program Templates</InputLabel>
                    <Select
                      multiple
                      label="Program Templates"
                      value={field.value || []}
                      onChange={e => {
                        const value = e.target.value as number[];
                        field.onChange(value);
                        setSelectedTemplates(value);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as number[]).map((value) => {
                            const template = programTemplates.find(t => t.program_template_id === value);
                            return (
                              <Chip 
                                key={value} 
                                label={template?.program_template_name || `Template ${value}`}
                                size="small"
                              />
                            );
                          })}
                        </Box>
                      )}
                    >
                      {programTemplates.map(template => (
                        <MenuItem
                          key={template.program_template_id}
                          value={template.program_template_id}
                        >
                          <Checkbox
                            checked={(field.value || []).indexOf(template.program_template_id) > -1}
                          />
                          <ListItemText
                            primary={`${template.program_template_name} - $${(template.total_charge || 0).toFixed(2)}`}
                            secondary={template.description}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.selected_template_ids && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 1, display: 'block' }}
                      >
                        {errors.selected_template_ids.message}
                      </Typography>
                    )}
                  </FormControl>
                );
              }}
            />

            {/* Cost Summary */}
            {selectedTemplates.length > 0 && (
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Cost Summary
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Total Cost:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${totalCost.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Total Charge:</Typography>
                    <Typography variant="body2" fontWeight="bold" color="primary">
                      ${totalCharge.toFixed(2)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Program Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Provide the final details for the program.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Controller
                name="program_template_name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Program Name"
                    fullWidth
                    required
                    error={!!errors.program_template_name}
                    helperText={errors.program_template_name?.message}
                  />
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={3}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 0 },
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div">
          Create New Program
        </Typography>
        <Stepper activeStep={activeStep} sx={{ mt: 2 }}>
          {steps.map((label, index) => (
            <Step key={label} completed={completedSteps.has(index)}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>

      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          {renderStepContent(activeStep)}
        </form>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={handleClose} sx={{ borderRadius: 0 }}>
          Cancel
        </Button>

        {activeStep > 0 && (
          <Button onClick={handleBack} sx={{ borderRadius: 0 }}>
            Back
          </Button>
        )}

        {activeStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{ borderRadius: 0 }}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={createProgram.isPending}
            sx={{ borderRadius: 0 }}
          >
            {createProgram.isPending ? 'Creating...' : 'Create Program'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
