'use client';

import React from 'react';
import { Box, Chip, Alert } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms } from '@/types/database.types';
import { useProgramToDo } from '@/lib/hooks/use-program-todo';
import { getScheduleStatus, STATUS_CONFIG } from '@/lib/utils/schedule-status';
import {
  CheckCircle as RedeemedIcon,
  Cancel as MissedIcon,
  RadioButtonUnchecked as PendingIcon,
} from '@mui/icons-material';
import { useMemberProgram } from '@/lib/hooks/use-member-programs';
import { useProgramStatus } from '@/lib/hooks/use-program-status';
import { isProgramReadOnly, getReadOnlyMessage } from '@/lib/utils/program-readonly';

interface ProgramToDoTabProps {
  program: MemberPrograms;
}

export default function ProgramToDoTab({ program }: ProgramToDoTabProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useProgramToDo(program.member_program_id);
  const { data: freshProgram } = useMemberProgram(program.member_program_id);
  const { data: statuses = [] } = useProgramStatus();

  // Check if program is in read-only state (Completed or Cancelled)
  const currentStatus = statuses.find(
    s => s.program_status_id === (freshProgram?.program_status_id ?? program.program_status_id)
  );
  const isReadOnly = isProgramReadOnly(currentStatus?.status_name);
  const readOnlyMessage = getReadOnlyMessage(currentStatus?.status_name);

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
      headerName: 'Redeemed',
      width: 130,
      renderCell: params => {
        const row: any = params.row;
        const status = getScheduleStatus(row.completed_flag);
        const config = STATUS_CONFIG[status];
        
        const IconComponent = 
          status === 'redeemed' ? RedeemedIcon :
          status === 'missed' ? MissedIcon :
          PendingIcon;
        
        return (
          <Chip
            label={config.label}
            color={config.color}
            size="small"
            icon={<IconComponent sx={{ fontSize: 16 }} />}
          />
        );
      },
    },
    {
      field: 'updated_by_full_name',
      headerName: 'Updated By',
      width: 150,
      renderCell: (params: any) => params.value || '-',
    },
    {
      field: 'updated_at',
      headerName: 'Updated Date',
      width: 140,
      renderCell: renderDate as any,
    },
  ];

  return (
    <Box>
      {isReadOnly && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {readOnlyMessage}
        </Alert>
      )}
      <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
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
        persistStateKey="programToDoGrid"
      />
      </fieldset>
    </Box>
  );
}
