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
  Grid
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { memberProgramSchema, MemberProgramFormData } from '@/lib/validations/member-program';
import { MemberPrograms } from '@/types/database.types';
import { useActiveLeads } from '@/lib/hooks/use-leads';
import { useActiveProgramStatus } from '@/lib/hooks/use-program-status';

interface ProgramInfoTabProps {
  program: MemberPrograms;
  onProgramUpdate: (program: MemberPrograms) => void;
  onUnsavedChangesChange: (hasChanges: boolean) => void;
}

export default function ProgramInfoTab({ program, onProgramUpdate, onUnsavedChangesChange }: ProgramInfoTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const { data: leads = [] } = useActiveLeads();
  const { data: programStatuses = [] } = useActiveProgramStatus();
  
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset
  } = useForm<MemberProgramFormData>({
    resolver: zodResolver(memberProgramSchema),
    defaultValues: {
      program_template_name: program.program_template_name || '',
      description: program.description || '',
      lead_id: program.lead_id,
      start_date: program.start_date || '',
      program_status_id: program.program_status_id || null,
      active_flag: program.active_flag,
    }
  });

  // Reset form when program changes
  React.useEffect(() => {
    reset({
      program_template_name: program.program_template_name || '',
      description: program.description || '',
      lead_id: program.lead_id,
      start_date: program.start_date,
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

  const onSubmit = async (data: MemberProgramFormData) => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      const updatedProgram = { 
        ...program, 
        ...data,
        description: data.description || null,
      };
      await onProgramUpdate(updatedProgram);
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save program:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* Column 1: Program Name, Member, Status, Start Date */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
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
                  value={field.value && leads.some(lead => lead.lead_id === field.value) ? field.value : ''}
                  onChange={(e) => {
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
                  {leads.map((lead) => (
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
                  value={field.value && programStatuses.some(status => status.program_status_id === field.value) ? field.value : ''}
                  onChange={(e) => {
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
                  {programStatuses.map((status) => (
                    <MenuItem key={status.program_status_id} value={status.program_status_id}>
                      {status.status_name}
                    </MenuItem>
                  ))}
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
                  error={!!errors.start_date}
                  helperText={errors.start_date?.message}
                />
              )}
            />
          </Box>

          {/* Column 2: Active Flag, Description */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <Controller
              name="active_flag"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
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
                  label="Description"
                  fullWidth
                  multiline
                  rows={6}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  sx={{ 
                    flex: 1,
                    '& .MuiInputBase-root': {
                      height: '100%',
                      minHeight: '200px'
                    }
                  }}
                />
              )}
            />
          </Box>

        </Box>
        
        {/* Save Button and Status */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
          {/* Success Message */}
          {saveSuccess && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              color: 'success.main',
              fontSize: '0.875rem'
            }}>
              ✓ Changes saved successfully!
            </Box>
          )}
          
          {/* Save Button */}
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : null}
            sx={{
              borderRadius: 0,
              fontWeight: 600,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
