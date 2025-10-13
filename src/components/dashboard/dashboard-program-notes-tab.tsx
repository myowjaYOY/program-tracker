'use client';

import React from 'react';
import { Box, Button } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms } from '@/types/database.types';
import { useLeadNotes } from '@/lib/hooks/use-lead-notes';
import { LeadNotesModal } from '@/components/notes';

interface DashboardProgramNotesTabProps {
  program: MemberPrograms | null;
  memberId?: number | null;
}

export default function DashboardProgramNotesTab({ program, memberId = null }: DashboardProgramNotesTabProps) {
  const leadId = memberId ?? program?.lead_id ?? null;
  const leadName = program?.lead_name || '';

  const { data, isLoading, error } = useLeadNotes(leadId || 0) as any;
  const rows = (data?.data || []).map((n: any) => ({
    ...n,
    id: n.note_id,
  }));

  const cols: GridColDef[] = [
    { field: 'note_type', headerName: 'Type', width: 140 },
    { field: 'note', headerName: 'Note', width: 520 },
    { field: 'created_by_name', headerName: 'Created By', width: 180 },
    { field: 'created_at', headerName: 'Created At', width: 160, renderCell: renderDate as any },
  ];

  const [open, setOpen] = React.useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          onClick={() => setOpen(true)}
          disabled={!leadId}
          sx={{ borderRadius: 0, fontWeight: 600 }}
        >
          Add Note
        </Button>
      </Box>

      <BaseDataTable
        title=""
        data={rows}
        columns={cols}
        loading={isLoading}
        error={error ? (error as any).message : null}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight
      />

      {open && leadId && (
        <LeadNotesModal
          open={open}
          onClose={() => setOpen(false)}
          leadId={leadId}
          leadName={leadName || `Lead #${leadId}`}
        />
      )}
    </Box>
  );
}



