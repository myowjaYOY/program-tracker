'use client';

import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { memberProgramItemTaskSchema, MemberProgramItemTaskFormData } from '@/lib/validations/member-program-item-task';
import { useMemberProgramItems } from '@/lib/hooks/use-member-program-items';

interface AddTaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: MemberProgramItemTaskFormData) => void;
  programId: number;
  loading?: boolean;
}

export default function AddTaskForm({ open, onClose, onSubmit, programId, loading = false }: AddTaskFormProps) {
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MemberProgramItemTaskFormData>({
    resolver: zodResolver(memberProgramItemTaskSchema),
    defaultValues: {
      member_program_item_id: 0,
      task_id: 0, // This will be set to 0 for new tasks
      task_name: '',
      description: '',
      task_delay: 0,
      completed_flag: false,
    },
  });

  // Fetch program items for the dropdown
  const { data: programItems = [], isLoading: itemsLoading, error: itemsError } = useMemberProgramItems(programId);
  
  

  const handleFormSubmit = (data: MemberProgramItemTaskFormData) => {
    // Set task_id to 0 for new tasks (not associated with therapy tasks)
    const taskData = {
      ...data,
      task_id: 0,
    };
    onSubmit(taskData);
    reset();
  };

  const handleClose = () => {
    reset();
    setSelectedItemId('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          width: '500px',
          maxWidth: '90vw',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        Add Task
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Therapy Selection */}
            <FormControl fullWidth error={!!errors.member_program_item_id}>
              <InputLabel>Therapy</InputLabel>
              <Controller
                name="member_program_item_id"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Therapy"
                    value={field.value || ''}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      setSelectedItemId(e.target.value);
                    }}
                    disabled={itemsLoading}
                  >
                    {itemsLoading ? (
                      <MenuItem disabled>Loading items...</MenuItem>
                    ) : itemsError ? (
                      <MenuItem disabled>Error loading items</MenuItem>
                    ) : programItems.length === 0 ? (
                      <MenuItem disabled>No items found</MenuItem>
                    ) : (
                      programItems.map((item) => (
                        <MenuItem key={item.member_program_item_id} value={item.member_program_item_id}>
                          {item.therapies?.therapy_name || 'Unknown Therapy'}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                )}
              />
              {errors.member_program_item_id && (
                <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>
                  {errors.member_program_item_id.message}
                </Box>
              )}
              {itemsError && (
                <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>
                  Error loading program items: {itemsError.message}
                </Box>
              )}
            </FormControl>

            {/* Task Name */}
            <Controller
              name="task_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Task Name"
                  fullWidth
                  disabled={!selectedItemId}
                  error={!!errors.task_name}
                  helperText={errors.task_name?.message}
                />
              )}
            />

            {/* Task Delay */}
            <Controller
              name="task_delay"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Task Delay (Days)"
                  type="number"
                  fullWidth
                  disabled={!selectedItemId}
                  error={!!errors.task_delay}
                  helperText={errors.task_delay?.message}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    field.onChange(value);
                  }}
                />
              )}
            />

            {/* Description */}
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
                  disabled={!selectedItemId}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                />
              )}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'flex-end' }}>
        <Button
          onClick={handleSubmit(handleFormSubmit)}
          variant="contained"
          color="primary"
          disabled={loading || !selectedItemId}
          sx={{ borderRadius: 0 }}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}