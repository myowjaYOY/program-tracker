'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Chip, Box } from '@mui/material';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import TherapyTaskForm from '@/components/forms/therapy-task-form';
import {
  useTherapyTasks,
  useDeleteTherapyTask,
} from '@/lib/hooks/use-therapy-tasks';
import { TherapyTasks } from '@/types/database.types';
import { TherapyTaskFormData } from '@/lib/validations/therapy-task';

// Extend TherapyTasks to satisfy BaseEntity interface
interface TherapyTaskEntity
  extends Omit<TherapyTasks, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
  therapy_name?: string; // This will come from the API join
}

// Therapy Task-specific columns
const therapyTaskColumns: GridColDef[] = [
  {
    field: 'task_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'therapy_name',
    headerName: 'Therapy',
    width: 150,
    renderCell: params => (
      <Box
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
        title={params.value || ''}
      >
        {params.value || '-'}
      </Box>
    ),
  },
  {
    field: 'task_name',
    headerName: 'Task Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 250,
    flex: 1,
    renderCell: params => (
      <Box
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
        title={params.value || ''}
      >
        {params.value || '-'}
      </Box>
    ),
  },
  {
    field: 'task_delay',
    headerName: 'Delay (days)',
    width: 120,
    type: 'number',
    renderCell: params => (
      <Chip
        label={params.value}
        color={
          params.value < 0 ? 'warning' : params.value > 0 ? 'info' : 'default'
        }
        size="small"
        variant="outlined"
      />
    ),
  },
  commonColumns.activeFlag,
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

export default function TherapyTaskTable() {
  const { data: therapyTasks, isLoading, error } = useTherapyTasks();
  const deleteTherapyTask = useDeleteTherapyTask();

  const handleDelete = (id: string | number) => {
    deleteTherapyTask.mutate(String(id));
  };

  const handleEdit = (_row: TherapyTaskEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
    // console.log('Edit therapy task:', row);
  };

  const renderTherapyTaskForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<TherapyTaskEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert TherapyTaskEntity to TherapyTaskFormData for the form
    const formData: Partial<TherapyTaskFormData> & { task_id?: number } =
      initialValues
        ? {
            therapy_type_id: (initialValues as any).therapy_type_id || 0,
            therapy_id: initialValues.therapy_id || 0,
            task_name: initialValues.task_name || '',
            description: initialValues.description || '',
            task_delay: initialValues.task_delay || 0,
            active_flag: initialValues.active_flag ?? true,
            ...(initialValues.task_id && {
              task_id: initialValues.task_id,
            }),
          }
        : {};

    return (
      <TherapyTaskForm
        initialValues={formData}
        onSuccess={onClose}
        mode={mode}
      />
    );
  };

  // Transform therapy tasks data to include id property and handle null dates
  const therapyTasksWithId: TherapyTaskEntity[] = (therapyTasks || []).map(
    (task: any) => ({
      ...task,
      id: task.task_id,
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
      created_by: task.created_by_email || '-',
      updated_by: task.updated_by_email || '-',
    })
  );

  return (
    <BaseDataTable<TherapyTaskEntity>
      title="Therapy Tasks"
      data={therapyTasksWithId}
      columns={therapyTaskColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.task_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderTherapyTaskForm}
      createButtonText="Add Therapy Task"
      editButtonText="Edit Therapy Task"
      deleteButtonText="Delete Therapy Task"
      deleteConfirmMessage="Are you sure you want to delete this therapy task? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
