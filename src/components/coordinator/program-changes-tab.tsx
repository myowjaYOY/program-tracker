'use client';

import React, { useState } from 'react';
import { Box, TextField, MenuItem, Button } from '@mui/material';
import BaseDataTable, {
  renderDateTime,
} from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { useCoordinatorProgramChanges } from '@/lib/hooks/use-coordinator';

interface ProgramChangesTabProps {
  range?: 'all' | 'today' | 'week' | 'month' | 'custom';
  start?: string | undefined;
  end?: string | undefined;
}

export default function ProgramChangesTab({
  range = 'all',
  start,
  end,
}: ProgramChangesTabProps) {
  const [sources, setSources] = useState<string[]>([]);
  const {
    data = [],
    isLoading,
    error,
  } = useCoordinatorProgramChanges({
    range,
    start: start ?? null,
    end: end ?? null,
    sources,
  });

  const sourceOptions = [
    'Payments',
    'Script',
    'Items',
    'Tasks',
    'Finance',
    'To Do',
    'Information',
  ];

  const rows = (data as any[]).map((r, idx) => ({
    id: r.id ?? `${r.changed_at}-${idx}`,
    source: r.source,
    member_name: r.member_name,
    program_name: r.program_name,
    change_description: r.change_description,
    changed_by_email: r.changed_by_email,
    changed_at: r.changed_at,
  }));

  const cols: GridColDef[] = [
    { field: 'member_name', headerName: 'Member', width: 220 },
    { field: 'program_name', headerName: 'Program', width: 240 },
    { field: 'source', headerName: 'Source', width: 160 },
    {
      field: 'change_description',
      headerName: 'Change',
      flex: 1,
      minWidth: 360,
    },
    { field: 'changed_by_email', headerName: 'Changed By', width: 260 },
    {
      field: 'changed_at',
      headerName: 'Changed At',
      width: 200,
      renderCell: renderDateTime as any,
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField
          select
          label="Source"
          value={sources}
          onChange={e => {
            const value = e.target.value;
            setSources(
              typeof value === 'string'
                ? value.split(',').filter(Boolean)
                : (value as string[])
            );
          }}
          size="small"
          sx={{ minWidth: 240 }}
          SelectProps={{
            multiple: true,
            renderValue: selected => (selected as string[]).join(', '),
          }}
        >
          {sourceOptions.map(opt => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        {sources.length > 0 && (
          <Button variant="text" size="small" onClick={() => setSources([])}>
            Clear
          </Button>
        )}
      </Box>
      <BaseDataTable<any>
        title=""
        data={rows}
        columns={cols}
        loading={isLoading}
        error={error ? (error as any).message : null}
        showCreateButton={false}
        showActionsColumn={false}
        showTitle={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
      />
    </Box>
  );
}
