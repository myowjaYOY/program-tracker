'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Switch,
  FormControlLabel,
  TextField,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import BaseDataTable from '@/components/tables/base-data-table';
import { MemberPrograms, MemberProgramItemTasks } from '@/types/database.types';
import {
  useMemberProgramItemTasks,
  useUpdateMemberProgramItemTask,
  useDeleteMemberProgramItemTask,
} from '@/lib/hooks/use-member-program-item-tasks';
import { MemberProgramItemTaskFormData } from '@/lib/validations/member-program-item-task';
import { useForm, Controller } from 'react-hook-form';
import { GridColDef } from '@mui/x-data-grid';

interface ProgramTasksTabProps {
  program: MemberPrograms;
}

// Extended interface for tasks with joined data
interface ProgramTaskWithDetails extends MemberProgramItemTasks {
  id: number;
}

export default function ProgramTasksTab({ program }: ProgramTasksTabProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProgramTaskWithDetails | null>(
    null
  );

  const { data: programTasks = [], isLoading } = useMemberProgramItemTasks(
    program.member_program_id
  );

  const updateTask = useUpdateMemberProgramItemTask();
  const deleteTask = useDeleteMemberProgramItemTask();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<{
    task_delay: number;
    description: string;
    completed_flag: boolean;
  }>({
    defaultValues: {
      task_delay: 0,
      description: '',
      completed_flag: false,
    },
  });

  const handleUpdateTask = async (
    updates: Partial<MemberProgramItemTaskFormData>
  ) => {
    if (!editingTask) return;

    return updateTask.mutateAsync({
      programId: program.member_program_id,
      taskId: editingTask.member_program_item_task_id,
      data: updates,
    });
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await deleteTask.mutateAsync({
        programId: program.member_program_id,
        taskId: taskId,
      });
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleEditTask = (task: ProgramTaskWithDetails) => {
    setEditingTask(task);
    setValue('task_delay', task.task_delay);
    setValue('description', task.description || '');
    setValue('completed_flag', task.completed_flag);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (data: {
    task_delay: number;
    description: string;
    completed_flag: boolean;
  }) => {
    if (!editingTask) return;

    try {
      await handleUpdateTask({
        task_delay: data.task_delay,
        description: data.description,
        completed_flag: data.completed_flag,
      });

      // Only close modal after successful update
      setIsEditModalOpen(false);
      setEditingTask(null);
      reset();
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error('Error updating task:', error);
    }
  };

  // Map the data to include the required id field and flatten joined data
  const mappedProgramTasks = (programTasks || []).map((task: any) => ({
    ...task,
    id: task.member_program_item_task_id,
    therapy_name: task.therapy_tasks?.therapies?.therapy_name || '',
    therapy_type_name:
      task.therapy_tasks?.therapies?.therapytype?.therapy_type_name || '',
  }));

  const columns: GridColDef[] = [
    {
      field: 'therapy_type_name',
      headerName: 'Therapy Type',
      width: 150,
    },
    {
      field: 'therapy_name',
      headerName: 'Therapy',
      width: 200,
    },
    {
      field: 'task_name',
      headerName: 'Task Name',
      width: 200,
    },
    {
      field: 'description',
      headerName: 'Description',
      width: 250,
      renderCell: (params: any) => {
        return params.value || '';
      },
    },
    {
      field: 'task_delay',
      headerName: 'Delay (Days)',
      width: 150,
      renderCell: (params: any) => {
        const value = params.value || 0;
        return (
          <Chip
            label={`${value > 0 ? '+' : ''}${value} days`}
            color={value > 0 ? 'primary' : value < 0 ? 'error' : 'default'}
            size="small"
          />
        );
      },
    },
    {
      field: 'completed_flag',
      headerName: 'Status',
      width: 120,
      renderCell: (params: any) => {
        if (!params?.row) return null;
        return (
          <Chip
            label={params.value ? 'Completed' : 'Pending'}
            color={params.value ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'completed_date',
      headerName: 'Completed Date',
      width: 150,
      renderCell: (params: any) => {
        if (!params.value) return '';
        return new Date(params.value).toLocaleDateString();
      },
    },
    {
      field: 'completed_by_email',
      headerName: 'Completed By',
      width: 150,
      renderCell: (params: any) => {
        return params.value || '';
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: any) => {
        if (!params?.row) return null;
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => handleEditTask(params.row)}
              color="primary"
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() =>
                handleDeleteTask(params.row.member_program_item_task_id)
              }
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <BaseDataTable<any>
        title=""
        data={mappedProgramTasks}
        columns={columns}
        loading={isLoading}
        getRowId={row => row.member_program_item_task_id}
        showCreateButton={false}
        showActionsColumn={false}
      />

      {/* Edit Task Modal */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTask(null);
          reset();
        }}
        maxWidth="sm"
        fullWidth={false}
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
          Edit Task
          <IconButton
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingTask(null);
              reset();
            }}
            size="small"
            disabled={updateTask.isPending}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {editingTask && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Therapy - Read Only */}
                <TextField
                  label="Therapy"
                  value={editingTask.therapy_name || 'Custom Task'}
                  fullWidth
                  disabled
                  variant="outlined"
                />

                {/* Task Name - Read Only */}
                <TextField
                  label="Task Name"
                  value={editingTask.task_name}
                  fullWidth
                  disabled
                  variant="outlined"
                />

                {/* Task Delay - Editable */}
                <Controller
                  name="task_delay"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Task Delay (Days)"
                      type="number"
                      fullWidth
                      disabled={updateTask.isPending}
                      error={!!errors.task_delay}
                      helperText={errors.task_delay?.message}
                      onChange={e => {
                        const value =
                          e.target.value === ''
                            ? 0
                            : parseInt(e.target.value, 10);
                        field.onChange(value);
                      }}
                    />
                  )}
                />

                {/* Description - Editable */}
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
                      disabled={updateTask.isPending}
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
              </Box>

              {/* Completion Status Toggle */}
              <Box sx={{ mt: 3 }}>
                <Controller
                  name="completed_flag"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                          disabled={updateTask.isPending}
                        />
                      }
                      label={`Mark as ${field.value ? 'Incomplete' : 'Complete'}`}
                    />
                  )}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'flex-end' }}>
          <Button
            onClick={handleSubmit(handleEditSubmit)}
            variant="contained"
            color="primary"
            disabled={updateTask.isPending}
            sx={{ borderRadius: 0, minWidth: 120 }}
          >
            {updateTask.isPending ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Updating...
              </>
            ) : (
              'Update'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
