'use client';

import React, { useState } from 'react';
import { Box, IconButton, Chip, Tooltip } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EditNoteIcon from '@mui/icons-material/EditNote';
import {
  useCoordinatorScript,
  coordinatorKeys,
} from '@/lib/hooks/use-coordinator';
import { useQueryClient } from '@tanstack/react-query';
import { LeadNotesModal } from '@/components/notes';

interface CoordinatorScriptTabProps {
  memberId?: number | null;
  range?: 'all' | 'today' | 'week' | 'month' | 'custom';
  start?: string | undefined;
  end?: string | undefined;
  showCompleted?: boolean;
}

type Row = {
  member_program_item_schedule_id: number;
  member_program_item_id: number;
  member_program_id: number;
  program_status_name?: string | null;
  instance_number: number;
  scheduled_date: string;
  completed_flag: boolean;
  therapy_name?: string | null;
  therapy_type_name?: string | null;
  program_role_id?: number | null;
  role_name?: string | null;
  role_display_color?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_by_email?: string | null;
  updated_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_full_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function CoordinatorScriptTab({
  memberId = null,
  range = 'all',
  start,
  end,
  showCompleted = false,
}: CoordinatorScriptTabProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useCoordinatorScript({
    memberId: memberId ?? null,
    range,
    start: start ?? null,
    end: end ?? null,
    showCompleted,
  });
  const qc = useQueryClient();

  // Notes modal state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<{
    id: number;
    name: string;
  } | null>(null);

  async function toggleComplete(row: Row): Promise<void> {
    // Generate query key exactly the same way as the hook
    const sp = new URLSearchParams();
    if (memberId) sp.set('memberId', String(memberId));
    if (range && range !== 'all') sp.set('range', range);
    const qs = sp.toString();
    const queryKey = coordinatorKeys.script(qs);

    // Optimistic update - immediately update the UI
    qc.setQueryData(queryKey, (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((item: any) => 
        item.member_program_item_schedule_id === row.member_program_item_schedule_id
          ? { ...item, completed_flag: !row.completed_flag }
          : item
      );
    });

    try {
      const url = `/api/member-programs/${row.member_program_id}/schedule/${row.member_program_item_schedule_id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed_flag: !row.completed_flag }),
      });
      
      if (!res.ok) {
        // Revert optimistic update on error
        qc.invalidateQueries({ queryKey });
        return;
      }
      
      // Ensure data is fresh after successful update
      await qc.invalidateQueries({ queryKey });
      
      // Also invalidate metrics to update the cards
      qc.invalidateQueries({ queryKey: coordinatorKeys.metrics() });
    } catch {
      // Revert optimistic update on error
      qc.invalidateQueries({ queryKey });
    }
  }

  const handleOpenNotesModal = (leadId: number, memberName: string) => {
    setSelectedLead({ id: leadId, name: memberName });
    setIsNotesModalOpen(true);
  };

  const handleCloseNotesModal = () => {
    setIsNotesModalOpen(false);
    setSelectedLead(null);
    // Invalidate script query to refresh note counts
    qc.invalidateQueries({
      queryKey: coordinatorKeys.script(
        new URLSearchParams(
          memberId ? { memberId: String(memberId), range } : { range }
        ).toString()
      ),
    });
  };

  const rows: any[] = (data as any[]).map((r: any) => ({
    ...r,
    id: r.member_program_item_schedule_id,
    therapy_name: r.therapy_name ?? '',
    therapy_type: r.therapy_type_name ?? '',
    created_by: r.created_by_full_name ?? r.created_by_email ?? r.created_by ?? '-',
    updated_by: r.updated_by_full_name ?? r.updated_by_email ?? r.updated_by ?? '-',
  }));

  const cols: GridColDef<Row>[] = [
    {
      field: 'notes',
      headerName: 'Note',
      width: 80,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as any;
        const noteCount = row.note_count || 0;
        const memberName = row.member_name || `Lead #${row.lead_id}`;
        const leadId = row.lead_id;
        
        if (!leadId) return null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title={`View/Add Notes for ${memberName}`}>
              <IconButton
                size="small"
                onClick={() => handleOpenNotesModal(leadId, memberName)}
                sx={{ 
                  color: noteCount > 0 ? 'primary.main' : 'text.secondary',
                  '&:hover': { 
                    backgroundColor: 'primary.50',
                    color: 'primary.main'
                  }
                }}
              >
                <EditNoteIcon fontSize="small" />
                {noteCount > 0 && (
                  <Chip
                    label={noteCount}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      height: 16,
                      minWidth: 16,
                      fontSize: '0.7rem',
                      '& .MuiChip-label': {
                        px: 0.5,
                      },
                    }}
                  />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
    { field: 'member_name', headerName: 'Member', width: 200 },
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
        const row = params.row as any as Row;
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
      renderCell: params => {
        const row = params.row as Row;
        const readOnly =
          (row.program_status_name || '').toLowerCase() !== 'active';
        return (
          <Box>
            <IconButton
              size="small"
              color={row.completed_flag ? 'success' : 'primary'}
              disabled={readOnly}
              onClick={() => {
                if (!readOnly) void toggleComplete(row);
              }}
            >
              {row.completed_flag ? (
                <CheckCircleOutlineIcon />
              ) : (
                <RadioButtonUncheckedIcon />
              )}
            </IconButton>
          </Box>
        );
      },
    },
    {
      field: 'role_name',
      headerName: 'Responsible',
      width: 100,
      renderCell: (params: any) => {
        const roleName = params.value || 'Admin';
        const roleColor = params.row.role_display_color || '#808080';
        return (
          <Chip
            label={roleName}
            size="small"
            sx={{
              backgroundColor: roleColor,
              color: '#fff',
              fontWeight: 500,
            }}
          />
        );
      },
    },
    { field: 'updated_by', headerName: 'Updated By', width: 180 } as any,
    {
      field: 'updated_at',
      headerName: 'Updated Date',
      width: 140,
      renderCell: renderDate as any,
    } as any,
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
        persistStateKey="coordinatorScriptGrid"
        rowClassName={row => {
          const isCompleted = !!(row as any).completed_flag;
          if (isCompleted) return '';
          const dateStr = (row as any).scheduled_date as string | undefined;
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
        enableExport={true}
        sortModel={[{ field: 'scheduled_date', sort: 'asc' }]}
      />

      {/* Lead Notes Modal */}
      {selectedLead && (
        <LeadNotesModal
          open={isNotesModalOpen}
          onClose={handleCloseNotesModal}
          leadId={selectedLead.id}
          leadName={selectedLead.name}
        />
      )}
    </Box>
  );
}
