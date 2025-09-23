'use client';

import React from 'react';
import { Box, IconButton, Chip } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms } from '@/types/database.types';
import {
  useProgramSchedule,
  useUpdateSchedule,
} from '@/lib/hooks/use-program-schedule';
import { useProgramStatus } from '@/lib/hooks/use-program-status';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

interface ProgramScriptTabProps {
  program: MemberPrograms;
}

type Row = {
  member_program_item_schedule_id: number;
  member_program_item_id: number;
  instance_number: number;
  scheduled_date: string;
  completed_flag: boolean;
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
  const update = useUpdateSchedule(program.member_program_id);
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
      headerName: 'Completed',
      width: 130,
      renderCell: params => {
        const row: any = params.row;
        const isCompleted = !!row.completed_flag;
        return (
          <Chip
            label={isCompleted ? 'Yes' : 'No'}
            color={isCompleted ? 'success' : 'default'}
            size="small"
            onClick={() => {
              if (!readOnly)
                update.mutate({
                  scheduleId: row.member_program_item_schedule_id,
                  completed_flag: !isCompleted,
                });
            }}
            sx={{ cursor: 'pointer' }}
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
            disabled={update.isPending || readOnly}
            onClick={() => {
              if (!readOnly)
                update.mutate({
                  scheduleId: params.row.member_program_item_schedule_id,
                  completed_flag: !params.row.completed_flag,
                });
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
  ];

  return (
    <Box>
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
      />
    </Box>
  );
}
