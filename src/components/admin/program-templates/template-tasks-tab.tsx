'use client';

import React from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable from '@/components/tables/base-data-table';
import {
  ProgramTemplate,
  ProgramTemplateItems,
  Therapies,
  TherapyTasks,
} from '@/types/database.types';
import { useProgramTemplateItems } from '@/lib/hooks/use-program-template-items';
import { useTherapies } from '@/lib/hooks/use-therapies';
import { useTherapyTasks } from '@/lib/hooks/use-therapy-tasks';

interface TemplateTasksTabProps {
  template: ProgramTemplate;
}

export default function TemplateTasksTab({ template }: TemplateTasksTabProps) {
  const { data: templateItems = [] } = useProgramTemplateItems(
    template.program_template_id
  );
  const { data: therapies = [] } = useTherapies();
  const { data: allTasks = [] } = useTherapyTasks();

  // Get all therapy IDs from template items
  const templateTherapyIds = templateItems.map(item => item.therapy_id);

  // Get all tasks associated with therapies in this template
  const templateTasks = allTasks.filter(
    task => templateTherapyIds.includes(task.therapy_id) && task.active_flag
  );

  // Map tasks to include therapy name for grouping
  const mappedTasks = templateTasks.map(task => {
    const therapy = therapies.find(t => t.therapy_id === task.therapy_id);
    return {
      ...task,
      id: task.task_id,
      therapy_name: therapy?.therapy_name || 'Unknown Therapy',
    };
  });

  // Define columns for the DataGrid
  const columns: GridColDef[] = [
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
      width: 300,
      renderCell: (params: any) => params.value || '-',
    },
    {
      field: 'task_delay',
      headerName: 'Delay (Days)',
      width: 150,
      renderCell: (params: any) => (
        <Chip
          label={`${params.value > 0 ? '+' : ''}${params.value} days`}
          color={
            params.value > 0
              ? 'primary'
              : params.value < 0
                ? 'error'
                : 'default'
          }
          size="small"
        />
      ),
    },
    {
      field: 'active_flag',
      headerName: 'Status',
      width: 120,
      renderCell: (params: any) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
  ];

  return (
    <Box>
      <BaseDataTable
        title=""
        data={mappedTasks as any}
        columns={columns}
        loading={false}
        showCreateButton={false}
        showActionsColumn={false}
        autoHeight
      />
    </Box>
  );
}
