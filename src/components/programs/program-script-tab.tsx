'use client';

import React from 'react';
import { Box, Chip, Alert } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms } from '@/types/database.types';
import { useProgramSchedule } from '@/lib/hooks/use-program-schedule';
import { getScheduleStatus, STATUS_CONFIG } from '@/lib/utils/schedule-status';
import {
  CheckCircle as RedeemedIcon,
  Cancel as MissedIcon,
  RadioButtonUnchecked as PendingIcon,
} from '@mui/icons-material';
import { useMemberProgram } from '@/lib/hooks/use-member-programs';
import { useProgramStatus } from '@/lib/hooks/use-program-status';
import { isProgramReadOnly, getReadOnlyMessage } from '@/lib/utils/program-readonly';

interface ProgramScriptTabProps {
  program: MemberPrograms;
}

type Row = {
  member_program_item_schedule_id: number;
  member_program_item_id: number;
  instance_number: number;
  scheduled_date: string;
  completed_flag: boolean | null;  // Three-state: true=redeemed, false=missed, null=pending
  member_program_items?: {
    therapies?: {
      therapy_name?: string;
      therapytype?: { therapy_type_name?: string };
    };
  };
};

export default function ProgramScriptTab({ program }: ProgramScriptTabProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useProgramSchedule(program.member_program_id);
  const { data: freshProgram } = useMemberProgram(program.member_program_id);
  const { data: statuses = [] } = useProgramStatus();

  // Check if program is in read-only state (Completed or Cancelled)
  const currentStatus = statuses.find(
    s => s.program_status_id === (freshProgram?.program_status_id ?? program.program_status_id)
  );
  const isReadOnly = isProgramReadOnly(currentStatus?.status_name);
  const readOnlyMessage = getReadOnlyMessage(currentStatus?.status_name);

  const rows: any[] = (data as any[]).map((r: any) => ({
    ...r,
    id: r.member_program_item_schedule_id,
    therapy_name:
      r.therapy_name ?? r.member_program_items?.therapies?.therapy_name ?? '',
    therapy_type:
      r.therapy_type_name ??
      r.member_program_items?.therapies?.therapytype?.therapy_type_name ??
      '',
  }));

  const cols: GridColDef<Row>[] = [
    {
      field: 'scheduled_date',
      headerName: 'Scheduled',
      width: 140,
      renderCell: renderDate as any,
    },
    { field: 'therapy_type', headerName: 'Therapy Type', width: 180 },
    { field: 'therapy_name', headerName: 'Therapy', width: 240 },
    {
      field: 'instance_number',
      headerName: 'Instance',
      width: 110,
      type: 'number',
    },
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
        data={rows as any}
        columns={cols as any}
        loading={isLoading}
        error={error ? (error as any).message : null}
        getRowId={row => row.member_program_item_schedule_id}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
        persistStateKey="programScriptGrid"
      />
      </fieldset>
    </Box>
  );
}
