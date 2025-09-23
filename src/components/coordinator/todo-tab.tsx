'use client';

import React from 'react';
import { Box, Chip, IconButton } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import {
  useCoordinatorToDo,
  coordinatorKeys,
} from '@/lib/hooks/use-coordinator';
import { useQueryClient } from '@tanstack/react-query';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

interface CoordinatorToDoTabProps {
  memberId?: number | null;
  range?: 'all' | 'today' | 'week' | 'month' | 'custom';
  start?: string | undefined;
  end?: string | undefined;
}

export default function CoordinatorToDoTab({
  memberId = null,
  range = 'all',
  start,
  end,
}: CoordinatorToDoTabProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useCoordinatorToDo({
    memberId: memberId ?? null,
    range,
    start: start ?? null,
    end: end ?? null,
  });
  const qc = useQueryClient();

  async function toggleComplete(row: any): Promise<void> {
    try {
      const url = `/api/member-programs/${row.member_program_id}/todo/${row.member_program_item_task_schedule_id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed_flag: !row.completed_flag }),
      });
      if (!res.ok) return;
      qc.invalidateQueries({
        queryKey: coordinatorKeys.todo(
          new URLSearchParams(
            memberId ? { memberId: String(memberId), range } : { range }
          ).toString()
        ),
      });
    } catch {}
  }

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
      created_by: r.created_by_email ?? r.created_by ?? '-',
      updated_by: r.updated_by_email ?? r.updated_by ?? '-',
    };
  });

  const cols: GridColDef[] = [
    { field: 'member_name', headerName: 'Member', width: 200 },
    {
      field: 'due_date',
      headerName: 'Due',
      width: 140,
      renderCell: renderDate as any,
    },
    { field: 'therapy_type', headerName: 'Therapy Type', width: 180 },
    { field: 'therapy_name', headerName: 'Therapy', width: 200 },
    { field: 'task_name', headerName: 'Task', width: 240 },
    { field: 'description', headerName: 'Description', width: 260 },
    {
      field: 'completed_flag',
      headerName: 'Completed',
      width: 130,
      renderCell: params => {
        const row: any = params.row;
        const isCompleted = !!row.completed_flag;
        const readOnly =
          (row.program_status_name || '').toLowerCase() !== 'active';
        return (
          <Chip
            label={isCompleted ? 'Yes' : 'No'}
            color={isCompleted ? 'success' : 'default'}
            size="small"
            onClick={() => {
              if (!readOnly) void toggleComplete(row);
            }}
            sx={{ cursor: readOnly ? 'default' : 'pointer' }}
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: params => (
        <Box>
          <IconButton
            size="small"
            color={params.row.completed_flag ? 'success' : 'primary'}
            disabled={
              (params.row.program_status_name || '').toLowerCase() !== 'active'
            }
            onClick={() => {
              if (
                (params.row.program_status_name || '').toLowerCase() ===
                'active'
              )
                void toggleComplete(params.row);
            }}
          >
            {params.row.completed_flag ? (
              <CheckCircleOutlineIcon />
            ) : (
              <RadioButtonUncheckedIcon />
            )}
          </IconButton>
        </Box>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Created Date',
      width: 140,
      renderCell: renderDate as any,
    } as any,
    { field: 'created_by', headerName: 'Created By', width: 180 } as any,
    {
      field: 'updated_at',
      headerName: 'Updated Date',
      width: 140,
      renderCell: renderDate as any,
    } as any,
    { field: 'updated_by', headerName: 'Updated By', width: 180 } as any,
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
        rowClassName={(row: any) => {
          if (row?.completed_flag) return '';
          const dateStr = row?.due_date as string | undefined;
          if (!dateStr) return '';
          const today = new Date();
          const date = new Date(dateStr);
          date.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          const diffDays = Math.floor(
            (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays < 0) return 'row-late';
          if (diffDays >= 5) return '';
          return `row-due-${diffDays}`;
        }}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
      />
    </Box>
  );
}
