'use client';

import React from 'react';
import { Box, Chip } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms } from '@/types/database.types';
import { useProgramToDo, useUpdateToDo } from '@/lib/hooks/use-program-todo';
import { useProgramStatus } from '@/lib/hooks/use-program-status';

interface ProgramToDoTabProps {
  program: MemberPrograms;
}

export default function ProgramToDoTab({ program }: ProgramToDoTabProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useProgramToDo(program.member_program_id);
  const update = useUpdateToDo(program.member_program_id);
  const { data: statuses = [] } = useProgramStatus();
  const statusName = (
    statuses.find(s => s.program_status_id === program.program_status_id)
      ?.status_name || ''
  ).toLowerCase();
  const readOnly =
    statusName === 'quote' ||
    statusName === 'paused' ||
    statusName === 'completed' ||
    statusName === 'cancelled';

  const rows = (data as any[]).map(r => {
    const tt =
      r?.member_program_item_tasks?.therapy_tasks?.therapies?.therapytype
        ?.therapy_type_name || '—';
    const tn =
      r?.member_program_item_tasks?.therapy_tasks?.therapies?.therapy_name ||
      '—';
    const task = r?.member_program_item_tasks?.task_name || '—';
    const desc = r?.member_program_item_tasks?.description || '';
    return {
      ...r,
      id: r.member_program_item_task_schedule_id,
      therapy_type: tt,
      therapy_name: tn,
      task_name: task,
      description: desc,
    };
  });

  const cols: GridColDef[] = [
    {
      field: 'due_date',
      headerName: 'Due',
      width: 140,
      renderCell: renderDate as any,
    },
    { field: 'therapy_type', headerName: 'Therapy Type', width: 160 },
    { field: 'therapy_name', headerName: 'Therapy', width: 220 },
    { field: 'task_name', headerName: 'Task', width: 220 },
    { field: 'description', headerName: 'Description', width: 300 },
    {
      field: 'completed_flag',
      headerName: 'Completed',
      width: 130,
      renderCell: params => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'default'}
          size="small"
          onClick={() => {
            if (!readOnly)
              update.mutate({
                taskScheduleId: params.row.member_program_item_task_schedule_id,
                completed_flag: !params.value,
              });
          }}
          sx={{ cursor: 'pointer' }}
        />
      ),
    },
    {
      field: 'updated_at',
      headerName: 'Updated Date',
      width: 140,
      renderCell: renderDate as any,
    },
    {
      field: 'updated_by_full_name',
      headerName: 'Updated By',
      width: 150,
      renderCell: (params: any) => params.value || '-',
    },
  ];

  return (
    <Box>
      <BaseDataTable<any>
        title=""
        data={rows}
        columns={cols}
        loading={isLoading}
        error={error ? (error as any).message : null}
        getRowId={row => row.member_program_item_task_schedule_id}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
      />
    </Box>
  );
}
