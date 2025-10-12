'use client';

import React, { useState } from 'react';
import { Box, TextField, MenuItem, Button } from '@mui/material';
import BaseDataTable, {
  renderDateTime,
} from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { useCoordinatorProgramChanges } from '@/lib/hooks/use-coordinator';

interface ProgramChangesTabProps {
  memberId?: number | null;
  range?: 'all' | 'today' | 'week' | 'month' | 'custom';
  start?: string | undefined;
  end?: string | undefined;
  showMemberColumn?: boolean;
}

export default function ProgramChangesTab({
  memberId = null,
  range = 'all',
  start,
  end,
  showMemberColumn = true,
}: ProgramChangesTabProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useCoordinatorProgramChanges({
    memberId,
    range,
    start: start ?? null,
    end: end ?? null,
  });

  // Source filtering removed

  const rows = (data as any[]).map((r, idx) => ({
    id: r.id ?? `${r.event_at}-${idx}`,
    member_name: r.member_name,
    program_name: r.program_name,
    type: r.operation,
    item: r.item_name,
    column: r.changed_column,
    from: r.from_value,
    to: r.to_value,
    changed_by: r.changed_by_user,
    changed_at: r.event_at,
  }));

  const cols: GridColDef[] = [
    ...(showMemberColumn
      ? ([{ field: 'member_name', headerName: 'Member', width: 160 }] as GridColDef[])
      : ([] as GridColDef[])),
    { field: 'program_name', headerName: 'Program', width: 240 },
    { field: 'type', headerName: 'Type', width: 100 },
    { field: 'item', headerName: 'Item', width: 240 },
    { field: 'column', headerName: 'Column', width: 140 },
    // From/To take remaining width ~25% each via flex
    { field: 'from', headerName: 'From', flex: 1, minWidth: 220 },
    { field: 'to', headerName: 'To', flex: 1, minWidth: 220 },
    { field: 'changed_by', headerName: 'Changed By', width: 140 },
    { field: 'changed_at', headerName: 'Changed At', width: 180, renderCell: renderDateTime as any },
  ];

  return (
    <Box>
      {/* Source filter removed */}
      <BaseDataTable<any>
        title=""
        data={rows}
        columns={cols}
        loading={isLoading}
        error={error ? (error as any).message : null}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
        sortModel={[{ field: 'changed_at', sort: 'desc' }]}
      />
    </Box>
  );
}
