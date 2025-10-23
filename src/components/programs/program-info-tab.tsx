'use client';

import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  Paper,
  Button,
  CircularProgress,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { scheduleKeys } from '@/lib/hooks/use-program-schedule';
import { memberProgramItemTaskKeys } from '@/lib/hooks/use-member-program-item-tasks';
import { todoKeys } from '@/lib/hooks/use-program-todo';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  memberProgramSchema,
  MemberProgramFormData,
} from '@/lib/validations/member-program';
import { MemberPrograms } from '@/types/database.types';
import { useLeadsForProgramCreation } from '@/lib/hooks/use-leads';
import { useActiveProgramStatus } from '@/lib/hooks/use-program-status';
import FormStatus from '@/components/ui/FormStatus';
import { useMemberProgramFinances } from '@/lib/hooks/use-member-program-finances';
import { useMemberProgramPayments } from '@/lib/hooks/use-member-program-payments';
import { useFinancialsDerived } from '@/lib/hooks/use-financials-derived';
import { useMemberProgramItems } from '@/lib/hooks/use-member-program-items';
import { downloadQuoteFromTemplate, downloadContractFromTemplate } from '@/lib/utils/generate-quote-template';
import { loadTemplate, TEMPLATE_PATHS } from '@/lib/utils/template-loader';
import { generatePlanSummary } from '@/lib/utils/generate-plan-summary';
import { toast } from 'sonner';

interface ProgramInfoTabProps {
  program: MemberPrograms;
  onProgramUpdate: (program: MemberPrograms) => void;
  onUnsavedChangesChange: (hasChanges: boolean) => void;
}

export default function ProgramInfoTab({
  program,
  onProgramUpdate,
  onUnsavedChangesChange,
}: ProgramInfoTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState<string>('');
  const [pendingSave, setPendingSave] = useState<MemberProgramFormData | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [isGeneratingPlanSummary, setIsGeneratingPlanSummary] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads = [] } = useLeadsForProgramCreation();
  const { data: programStatuses = [] } = useActiveProgramStatus();

  // Status transition validation rules
  const getValidStatusTransitions = (currentStatusName: string): string[] => {
    const status = currentStatusName.toLowerCase();
    switch (status) {
      case 'quote':
        return ['active', 'cancelled'];
      case 'active':
        return ['paused', 'cancelled', 'completed'];
      case 'paused':
        return ['active', 'cancelled', 'completed'];
      case 'completed':
      case 'cancelled':
        return []; // Final states - no transitions allowed
      default:
        return []; // Unknown status - block all transitions
    }
  };
  const { data: finances } = useMemberProgramFinances(
    program.member_program_id
  );
  const { data: payments = [] } = useMemberProgramPayments(
    program.member_program_id
  );
  const { data: programItems = [] } = useMemberProgramItems(program.member_program_id);

  // Calculate total taxable charge from items (same as financials tab)
  const totalTaxableCharge = React.useMemo(() => {
    return (programItems || []).reduce((sum: number, item: any) => {
      const quantity = item.quantity || 1;
      const charge = item.item_charge || 0;
      const isTaxable = item.therapies?.taxable === true;
      
      if (isTaxable) {
        return sum + (charge * quantity);
      }
      return sum;
    }, 0);
  }, [programItems]);

  // Use the same financial calculations as the financials tab
  const { programPrice: derivedProgramPrice, taxes: derivedTaxes } = useFinancialsDerived({
    totalCharge: Number(program.total_charge || 0),
    totalCost: Number(program.total_cost || 0),
    financeCharges: Number(finances?.finance_charges || 0),
    discounts: Number(finances?.discounts || 0),
    taxes: Number(finances?.taxes || 0),
    totalTaxableCharge: totalTaxableCharge,
    isActive: false, // Contract template is for Quote programs
    lockedPrice: 0,
    variance: 0,
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    getValues,
    setValue,
  } = useForm<MemberProgramFormData>({
    resolver: zodResolver(memberProgramSchema),
    defaultValues: {
      program_template_name: program.program_template_name || '',
      description: program.description || '',
      lead_id: program.lead_id,
      start_date: program.start_date || '',
      duration: program.duration || 30,
      program_status_id: program.program_status_id || null,
      active_flag: program.active_flag,
    },
  });

  // Reset form when program changes
  React.useEffect(() => {
    reset({
      program_template_name: program.program_template_name || '',
      description: program.description || '',
      lead_id: program.lead_id,
      start_date: program.start_date,
      duration: program.duration || 30,
      program_status_id: program.program_status_id || null,
      active_flag: program.active_flag,
    });
    // Reset unsaved changes when program changes
    onUnsavedChangesChange(false);
  }, [program.member_program_id, reset, onUnsavedChangesChange]);

  // Track form changes and notify parent
  React.useEffect(() => {
    onUnsavedChangesChange(isDirty);
  }, [isDirty, onUnsavedChangesChange]);

  const performSave = async (data: MemberProgramFormData): Promise<boolean> => {
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const updatedProgram = {
        ...program,
        ...data,
        description: data.description || null,
        lead_id: data.lead_id ?? null,
        start_date: data.start_date ?? null,
        active_flag: data.active_flag ?? true,
        program_status_id: data.program_status_id ?? null,
      };
      await onProgramUpdate(updatedProgram);
      setStatusMsg({ ok: true, message: 'Changes saved successfully' });
      // Reset form values to saved state so isDirty becomes false and Save disables
      reset({
        program_template_name: updatedProgram.program_template_name || '',
        description: updatedProgram.description || '',
        lead_id: updatedProgram.lead_id,
        start_date: updatedProgram.start_date || '',
        duration: updatedProgram.duration || 30,
        program_status_id: updatedProgram.program_status_id || null,
        active_flag: updatedProgram.active_flag,
      });
      onUnsavedChangesChange(false);
      return true;
    } catch (error) {
      const msg = (error as any)?.message || 'Failed to save program';
      setStatusMsg({ ok: false, message: msg });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: MemberProgramFormData) => {
    // Business rules
    const currentStatus = (
      programStatuses.find(s => s.program_status_id === data.program_status_id)
        ?.status_name || ''
    ).toLowerCase();
    const prevStatus = (
      programStatuses.find(
        s => s.program_status_id === program.program_status_id
      )?.status_name || ''
    ).toLowerCase();

    // 0) Validate status transitions
    if (prevStatus && currentStatus && currentStatus !== prevStatus) {
      const validTransitions = getValidStatusTransitions(prevStatus);
      if (!validTransitions.includes(currentStatus)) {
        const validTransitionsStr = validTransitions.length > 0 
          ? validTransitions.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
          : 'None (final state)';
        setStatusMsg({
          ok: false,
          message: `Invalid status transition: ${prevStatus.charAt(0).toUpperCase() + prevStatus.slice(1)} cannot be changed to ${currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}. Valid options: ${validTransitionsStr}.`
        });
        return;
      }
    }

    // 1) Block transitions out of Completed/Cancelled (redundant with above, but keeping for clarity)
    if (
      (prevStatus === 'completed' || prevStatus === 'cancelled') &&
      currentStatus !== prevStatus
    ) {
      setConfirmText(
        'Programs in Completed or Cancelled status cannot transition to another status. Changes will be discarded.'
      );
      setPendingSave(null);
      setConfirmOpen(true);
      return;
    }

    // 1) If status is Active, Start Date cannot be null
    if (
      currentStatus === 'active' &&
      (!data.start_date || data.start_date === '')
    ) {
      // Surface validation on the field like other forms (MUI TextField error state)
      // We do this by setting a temporary error message in local status and aborting save.
      setStatusMsg({
        ok: false,
        message: 'Start Date is required when status is Active.',
      });
      return;
    }

    // 1b) If status is Active, program must have financing type selected
    if (currentStatus === 'active' && !finances?.financing_type_id) {
      setStatusMsg({
        ok: false,
        message: 'Financing Type must be selected before activating program.',
      });
      return;
    }

    // 1c) If status is Active, program must have at least one payment row
    if (currentStatus === 'active' && (!payments || payments.length === 0)) {
      setStatusMsg({
        ok: false,
        message: 'Program must have at least one payment before activating.',
      });
      return;
    }

    // 2) Status transitions: show confirm dialog using our standard pattern
    if (prevStatus === 'active' && currentStatus === 'paused') {
      setConfirmText(
        'All incomplete script items and tasks will be put on hold. Do you want to change status from Active to Paused?'
      );
      setPendingSave(data);
      setConfirmOpen(true);
      return;
    }
    if (prevStatus === 'paused' && currentStatus === 'active') {
      setConfirmText(
        'When reactivating the program, incomplete script items and tasks will be shifted forward by the pause duration. Proceed?'
      );
      setPendingSave(data);
      setConfirmOpen(true);
      return;
    }

    // No confirm needed → save directly
    await performSave(data);
  };

  const handleGenerateNewContractOptions = async () => {
    try {
      setIsGenerating(true);
      if (!finances) throw new Error('Program financial information not found.');

      // Check if there are existing discounts - if so, block generation
      const existingDiscounts = Number(finances?.discounts || 0);
      if (existingDiscounts !== 0) {
        toast.error('Cannot generate contract options when existing discounts are applied. Please remove discounts first.');
        return;
      }

      const contractData = {
        member: {
          name: program.lead_name || 'N/A',
          email: program.lead_email || 'N/A',
          phone: 'N/A',
          address: 'N/A',
        },
        program: {
          name: program.program_template_name || 'Program',
          description: program.description || 'No description available',
          startDate: program.start_date ? new Date(program.start_date).toLocaleDateString() : 'Not set',
          duration: 'Program duration not specified',
        },
        financials: {
          financeCharges: finances?.finance_charges || 0,
          taxes: derivedTaxes, // Use calculated taxes from shared function
          discounts: finances?.discounts || 0,
          finalTotalPrice: derivedProgramPrice, // Use calculated program price from shared function
          margin: finances?.margin || 0,
          totalTaxableCharge: totalTaxableCharge, // Use calculated taxable charge from program items
          // Raw data for contract options calculation
          totalCharge: Number(program.total_charge || 0),
          totalCost: Number(program.total_cost || 0),
        },
        payments: (payments || []).map(payment => ({
          paymentId: payment.member_program_payment_id,
          amount: payment.payment_amount || 0,
          dueDate: payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'Not set',
          ...(payment.payment_date && { paymentDate: new Date(payment.payment_date).toLocaleDateString() }),
        })),
        generatedDate: new Date().toLocaleDateString(),
      } as const;


      const templateBuffer = await loadTemplate(TEMPLATE_PATHS.NEW_CONTRACT);
      await downloadContractFromTemplate(contractData as any, templateBuffer);
      toast.success('New Contract Options document generated successfully!');
    } catch (error) {
      const errorMessage = (error as any)?.message || 'Failed to generate document';
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateQuote = async () => {
    try {
      setIsGeneratingQuote(true);
      
      // Check if financial data exists
      if (!finances) {
        throw new Error('Program financial information not found. Please ensure the program has financial data before generating a quote.');
      }

      // Prepare quote data using lead info already in program object
      const quoteData = {
        member: {
          name: program.lead_name || 'N/A',
          email: program.lead_email || 'N/A',
          phone: 'N/A', // Phone not available
          address: 'N/A', // Address not available
        },
        program: {
          name: program.program_template_name || 'Program',
          description: program.description || 'No description available',
          startDate: program.start_date ? new Date(program.start_date).toLocaleDateString() : 'Not set',
          duration: 'Program duration not specified',
        },
        financials: {
          financeCharges: finances?.finance_charges || 0,
          taxes: finances?.taxes || 0,
          discounts: finances?.discounts || 0,
          finalTotalPrice: finances?.final_total_price || 0,
          margin: finances?.margin || 0,
        },
        payments: (payments || []).map(payment => ({
          paymentId: payment.member_program_payment_id,
          amount: payment.payment_amount || 0,
          dueDate: payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'Not set',
          ...(payment.payment_date && { paymentDate: new Date(payment.payment_date).toLocaleDateString() }),
        })),
        generatedDate: new Date().toLocaleDateString(),
      };

      // Load the template (with fallback)
      let templateBuffer: ArrayBuffer;
      try {
        templateBuffer = await loadTemplate(TEMPLATE_PATHS.QUOTE);
      } catch (templateError) {
        throw new Error(`Template not found. Please ensure ${TEMPLATE_PATHS.QUOTE} exists in the public/templates directory. ${templateError instanceof Error ? templateError.message : ''}`);
      }
      
      // Generate and download the document from template
      await downloadQuoteFromTemplate(quoteData, templateBuffer);
      toast.success('Quote document generated successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to generate quote: ${errorMessage}`);
      console.error('Quote generation error:', error);
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  const handleGenerateContract = async () => {
    try {
      setIsGeneratingContract(true);
      
      // Check if financial data exists
      if (!finances) {
        throw new Error('Program financial information not found. Please ensure the program has financial data before generating a contract.');
      }

      // Prepare contract data using lead info already in program object
      const contractData = {
        member: {
          name: program.lead_name || 'N/A',
          email: program.lead_email || 'N/A',
          phone: 'N/A', // Phone not available
          address: 'N/A', // Address not available
        },
        program: {
          name: program.program_template_name || 'Program',
          description: program.description || 'No description available',
          startDate: program.start_date ? new Date(program.start_date).toLocaleDateString() : 'Not set',
          duration: 'Program duration not specified',
        },
        financials: {
          financeCharges: finances?.finance_charges || 0,
          taxes: finances?.taxes || 0,
          discounts: finances?.discounts || 0,
          finalTotalPrice: finances?.final_total_price || 0,
          margin: finances?.margin || 0,
        },
        payments: (payments || []).map(payment => ({
          paymentId: payment.member_program_payment_id,
          amount: payment.payment_amount || 0,
          dueDate: payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'Not set',
          ...(payment.payment_date && { paymentDate: new Date(payment.payment_date).toLocaleDateString() }),
        })),
        generatedDate: new Date().toLocaleDateString(),
      };

      // Load the contract template
      let templateBuffer: ArrayBuffer;
      try {
        templateBuffer = await loadTemplate(TEMPLATE_PATHS.CONTRACT);
      } catch (templateError) {
        throw new Error(`Template not found. Please ensure ${TEMPLATE_PATHS.CONTRACT} exists in the public/templates directory. ${templateError instanceof Error ? templateError.message : ''}`);
      }
      
      // Generate and download the document from template
      await downloadContractFromTemplate(contractData, templateBuffer);
      toast.success('Contract document generated successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to generate contract: ${errorMessage}`);
      console.error('Contract generation error:', error);
    } finally {
      setIsGeneratingContract(false);
    }
  };

  const handleGeneratePlanSummary = async () => {
    try {
      setIsGeneratingPlanSummary(true);
      await generatePlanSummary(program, programItems);
      toast.success('Plan Summary document generated successfully!');
    } catch (error) {
      const errorMessage = (error as any)?.message || 'Failed to generate document';
      toast.error(errorMessage);
    } finally {
      setIsGeneratingPlanSummary(false);
    }
  };


  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* Column 1: Program Name, Member, Status, Start Date */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
          >
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
              name="lead_id"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Member"
                  fullWidth
                  {...field}
                  disabled={!!program.member_program_id}
                  value={
                    field.value &&
                    leads.some(lead => lead.lead_id === field.value)
                      ? field.value
                      : ''
                  }
                  onChange={e => {
                    const value = e.target.value;
                    if (value === '') {
                      field.onChange(null);
                    } else {
                      field.onChange(Number(value));
                    }
                  }}
                  error={!!errors.lead_id}
                  helperText={errors.lead_id?.message}
                >
                  <MenuItem value="">
                    <em>Select a member</em>
                  </MenuItem>
                  {leads.map(lead => (
                    <MenuItem key={lead.lead_id} value={lead.lead_id}>
                      {lead.first_name} {lead.last_name} ({lead.email})
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="program_status_id"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Status"
                  fullWidth
                  {...field}
                  value={
                    field.value &&
                    programStatuses.some(
                      status => status.program_status_id === field.value
                    )
                      ? field.value
                      : ''
                  }
                  onChange={e => {
                    const value = e.target.value;
                    if (value === '') {
                      field.onChange(null);
                    } else {
                      field.onChange(Number(value));
                    }
                  }}
                  error={!!errors.program_status_id}
                  helperText={errors.program_status_id?.message}
                >
                  <MenuItem value="">
                    <em>Select a status</em>
                  </MenuItem>
                  {programStatuses.map(status => {
                    // Get current program status
                    const currentStatus = programStatuses.find(
                      s => s.program_status_id === program.program_status_id
                    );
                    const currentStatusName = currentStatus?.status_name || '';
                    
                    // Check if this transition is valid
                    const validTransitions = getValidStatusTransitions(currentStatusName);
                    const targetStatusName = (status.status_name || '').toLowerCase();
                    const isCurrentStatus = status.program_status_id === program.program_status_id;
                    const isValidTransition = isCurrentStatus || validTransitions.includes(targetStatusName);
                    
                    // Additional business rules for Active status
                    const isActive = targetStatusName === 'active';
                    const missingPayments = isActive && (!payments || payments.length === 0);
                    const missingFinancingType = isActive && !finances?.financing_type_id;
                    
                    const disabled = !isValidTransition || missingPayments || missingFinancingType;
                    
                    // Determine the reason for being disabled
                    let disabledReason = '';
                    if (!isCurrentStatus) {
                      if (!isValidTransition) {
                        disabledReason = 'Invalid transition';
                      } else if (missingFinancingType) {
                        disabledReason = 'Requires financing type';
                      } else if (missingPayments) {
                        disabledReason = 'Requires payment';
                      }
                    }
                    
                    return (
                      <MenuItem
                        key={status.program_status_id}
                        value={status.program_status_id}
                        disabled={disabled}
                      >
                        {status.status_name}
                        {disabledReason && (
                          <Typography
                            component="span"
                            sx={{ ml: 1, fontSize: '0.75rem', color: 'text.secondary' }}
                          >
                            ({disabledReason})
                          </Typography>
                        )}
                      </MenuItem>
                    );
                  })}
                </TextField>
              )}
            />

            <Controller
              name="start_date"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  {...field}
                  value={field.value || ''}
                  error={
                    !!errors.start_date ||
                    !!(statusMsg &&
                      !statusMsg.ok &&
                      statusMsg.message?.toLowerCase().includes('start date'))
                  }
                  helperText={
                    errors.start_date?.message ||
                    (statusMsg &&
                    !statusMsg.ok &&
                    statusMsg.message?.toLowerCase().includes('start date')
                      ? statusMsg.message
                      : undefined)
                  }
                />
              )}
            />
          </Box>

          {/* Column 2: Active Flag, Description */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
          >
            <Controller
              name="active_flag"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value ?? false}
                      onChange={e => field.onChange(e.target.checked)}
                    />
                  }
                  label="Active Flag"
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Member Goals"
                  fullWidth
                  multiline
                  rows={4}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-root': {
                      height: '100%',
                      minHeight: '140px',
                    },
                  }}
                />
              )}
            />

            <Controller
              name="duration"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Duration (days)"
                  type="number"
                  fullWidth
                  required
                  error={!!errors.duration}
                  helperText={errors.duration?.message}
                  inputProps={{ min: 1 }}
                  onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                />
              )}
            />
          </Box>
        </Box>

        {/* Buttons Row */}
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Left side: Document Generation Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleGenerateNewContractOptions}
              disabled={isGenerating}
              sx={{ minWidth: 100, borderRadius: 0 }}
              startIcon={isGenerating ? <CircularProgress size={16} /> : undefined}
            >
              {isGenerating ? 'Generating...' : 'Contract Options'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleGeneratePlanSummary}
              disabled={isGeneratingPlanSummary}
              sx={{ minWidth: 100, borderRadius: 0 }}
              startIcon={isGeneratingPlanSummary ? <CircularProgress size={16} /> : undefined}
            >
              {isGeneratingPlanSummary ? 'Generating...' : 'Plan Summary'}
            </Button>
          </Box>

          {/* Right side: Status + Generate Schedule + Save Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormStatus status={statusMsg} onClose={() => setStatusMsg(null)} />
            {/* Generate Schedule Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={async () => {
                try {
                  setIsGenerating(true);
                  // If there are unsaved changes, save first to prevent inconsistencies
                  if (isDirty) {
                    const ok = await performSave(getValues());
                    if (!ok) {
                      // Abort generation if save failed
                      return;
                    }
                  }
                  const currentStatus = (
                    programStatuses.find(
                      s =>
                        s.program_status_id ===
                        (getValues('program_status_id') ??
                          program.program_status_id)
                    )?.status_name || ''
                  ).toLowerCase();
                  const date = getValues('start_date') || program.start_date;
                  if (currentStatus !== 'active' || !date) {
                    setStatusMsg({
                      ok: false,
                      message:
                        'Program must be Active and have a Start Date to generate schedule.',
                    });
                    return;
                  }
                  const res = await fetch(
                    `/api/member-programs/${program.member_program_id}/schedule/generate`,
                    { method: 'POST', credentials: 'include' }
                  );
                  const json = await res.json();
                  if (!res.ok)
                    throw new Error(
                      json.error || 'Failed to generate schedule'
                    );
                  setStatusMsg({
                    ok: true,
                    message: 'Schedule generated successfully',
                  });
                  queryClient.invalidateQueries({
                    queryKey: scheduleKeys.lists(program.member_program_id),
                  });
                  queryClient.invalidateQueries({
                    queryKey: memberProgramItemTaskKeys.byProgram(
                      program.member_program_id
                    ),
                  });
                  queryClient.invalidateQueries({
                    queryKey: todoKeys.lists(program.member_program_id),
                  });
                } catch (e: any) {
                  setStatusMsg({
                    ok: false,
                    message: e?.message || 'Failed to generate schedule',
                  });
                } finally {
                  setIsGenerating(false);
                }
              }}
              disabled={(() => {
                const currentStatus = (
                  programStatuses.find(
                    s =>
                      s.program_status_id ===
                      (getValues('program_status_id') ??
                        program.program_status_id)
                  )?.status_name || ''
                ).toLowerCase();
                const date = getValues('start_date') || program.start_date;
                return isGenerating || currentStatus !== 'active' || !date;
              })()}
              sx={{ borderRadius: 0, fontWeight: 600 }}
            >
              {isGenerating ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} /> Generating...
                </>
              ) : (
                'Generate Schedule'
              )}
            </Button>
            {/* Save Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit(onSubmit)}
              disabled={!isDirty || isSaving}
              startIcon={isSaving ? <CircularProgress size={16} /> : null}
              sx={{ borderRadius: 0, fontWeight: 600 }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
        {/* Status Transition Confirmation Dialog */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Confirm Status Change</DialogTitle>
          <DialogContent>{confirmText}</DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                setPendingSave(null);
              }}
              color="primary"
              sx={{ borderRadius: 0 }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmOpen(false);
                if (!pendingSave) {
                  // Blocked transition case: revert UI to previous status
                  setValue(
                    'program_status_id',
                    program.program_status_id || null,
                    { shouldDirty: false }
                  );
                  setPendingSave(null);
                  return;
                }
                try {
                  const nextStatus = (
                    programStatuses.find(
                      s => s.program_status_id === pendingSave.program_status_id
                    )?.status_name || ''
                  ).toLowerCase();
                  const prevStatusName = (
                    programStatuses.find(
                      s => s.program_status_id === program.program_status_id
                    )?.status_name || ''
                  ).toLowerCase();
                  // If Active -> Paused, call pause RPC first
                  if (prevStatusName === 'active' && nextStatus === 'paused') {
                    const res = await fetch(
                      `/api/member-programs/${program.member_program_id}?action=pause`,
                      { method: 'POST', credentials: 'include' }
                    );
                    const json = await res.json();
                    if (!res.ok)
                      throw new Error(json.error || 'Failed to pause program');
                  }
                  await performSave(pendingSave);
                  // Invalidate derived data (Script/Tasks/ToDo) when status changes, especially when paused
                  queryClient.invalidateQueries({
                    queryKey: scheduleKeys.lists(program.member_program_id),
                  });
                  queryClient.invalidateQueries({
                    queryKey: memberProgramItemTaskKeys.byProgram(
                      program.member_program_id
                    ),
                  });
                  queryClient.invalidateQueries({
                    queryKey: todoKeys.lists(program.member_program_id),
                  });
                } catch (e: any) {
                  setStatusMsg({
                    ok: false,
                    message: e?.message || 'Failed to update program status',
                  });
                } finally {
                  setPendingSave(null);
                }
              }}
              color="error"
              variant="contained"
              sx={{ borderRadius: 0 }}
            >
              Proceed
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
