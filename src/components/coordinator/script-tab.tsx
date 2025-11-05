'use client';

import React, { useState } from 'react';
import { Box, IconButton, Chip, Tooltip } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import EditNoteIcon from '@mui/icons-material/EditNote';
import {
  useCoordinatorScript,
  coordinatorKeys,
} from '@/lib/hooks/use-coordinator';
import { useQueryClient } from '@tanstack/react-query';
import { LeadNotesModal } from '@/components/notes';
import ScheduleStatusChip from '@/components/ui/schedule-status-chip';
import { toast } from 'sonner';

interface CoordinatorScriptTabProps {
  memberId?: number | null;
  range?: 'all' | 'today' | 'week' | 'month' | 'custom';
  start?: string | undefined;
  end?: string | undefined;
  showCompleted?: boolean;
  hideMissed?: boolean;
}

type Row = {
  member_program_item_schedule_id: number;
  member_program_item_id: number;
  member_program_id: number;
  program_status_name?: string | null;
  instance_number: number;
  scheduled_date: string;
  completed_flag: boolean | null;  // Three-state: true=redeemed, false=missed, null=pending
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
  // For notes
  lead_id?: number | null;
  member_name?: string | null;
  note_count?: number;
};

export default function CoordinatorScriptTab({
  memberId = null,
  range = 'all',
  start,
  end,
  showCompleted = false,
  hideMissed = false,
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
    hideMissed,
  });
  const qc = useQueryClient();

  // Notes modal state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<{
    id: number;
    name: string;
  } | null>(null);

  async function handleStatusChange(row: Row, newValue: boolean | null): Promise<void> {
    // Generate query key exactly the same way as the hook
    const sp = new URLSearchParams();
    if (memberId) sp.set('memberId', String(memberId));
    if (range && range !== 'all') sp.set('range', range);
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    if (showCompleted) sp.set('showCompleted', 'true');
    if (hideMissed) sp.set('hideMissed', 'true');
    const qs = sp.toString();
    const queryKey = coordinatorKeys.script(qs);

    // Optimistic update - immediately update the UI
    qc.setQueryData(queryKey, (oldData: any) => {
      if (!oldData) return oldData;
      
      // If showing completed items, just update the value (never remove)
      if (showCompleted) {
        return oldData.map((item: any) => 
          item.member_program_item_schedule_id === row.member_program_item_schedule_id
            ? { ...item, completed_flag: newValue }
            : item
        );
      }
      
      // If hideMissed is active, handle accordingly
      if (hideMissed) {
        // Only showing pending - if changing to anything other than null, remove it
        if (newValue !== null) {
          return oldData.filter((item: any) => 
            item.member_program_item_schedule_id !== row.member_program_item_schedule_id
          );
        } else {
          // Changing back to pending - keep it
          return oldData.map((item: any) => 
            item.member_program_item_schedule_id === row.member_program_item_schedule_id
              ? { ...item, completed_flag: newValue }
              : item
          );
        }
      }
      
      // Default: showing pending + missed (not completed)
      if (newValue === true) {
        // Marking as redeemed - remove from list
        return oldData.filter((item: any) => 
          item.member_program_item_schedule_id !== row.member_program_item_schedule_id
        );
      } else {
        // Marking as missed or pending - update value (item stays in list)
        return oldData.map((item: any) => 
          item.member_program_item_schedule_id === row.member_program_item_schedule_id
            ? { ...item, completed_flag: newValue }
            : item
        );
      }
    });

    try {
      const url = `/api/member-programs/${row.member_program_id}/schedule/${row.member_program_item_schedule_id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed_flag: newValue }),
      });
      
      if (!res.ok) {
        // Revert optimistic update on error
        qc.invalidateQueries({ queryKey });
        toast.error('Failed to update status');
        return;
      }
      
      // Ensure data is fresh after successful update
      // Use refetchType: 'active' to force refetch even if data is within staleTime
      await qc.invalidateQueries({ 
        queryKey,
        refetchType: 'active'
      });
      
      // Also invalidate metrics to update the cards
      await qc.invalidateQueries({ 
        queryKey: coordinatorKeys.metrics(),
        refetchType: 'active'
      });
      
      // Success - no toast needed (optimistic update already shown)
    } catch {
      // Revert optimistic update on error
      qc.invalidateQueries({ queryKey });
      toast.error('Failed to update status');
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
    const sp = new URLSearchParams();
    if (memberId) sp.set('memberId', String(memberId));
    if (range && range !== 'all') sp.set('range', range);
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    if (showCompleted) sp.set('showCompleted', 'true');
    if (hideMissed) sp.set('hideMissed', 'true');
    qc.invalidateQueries({
      queryKey: coordinatorKeys.script(sp.toString()),
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
    { field: 'member_name', headerName: 'Member' },
    {
      field: 'scheduled_date',
      headerName: 'Scheduled',
      renderCell: renderDate as any,
    },
    { field: 'therapy_type', headerName: 'Therapy Type' },
    { field: 'therapy_name', headerName: 'Therapy' },
    {
      field: 'instance_number',
      headerName: 'Instance',
      type: 'number',
    },
    {
      field: 'completed_flag',
      headerName: 'Redeemed',
      renderCell: params => {
        const row = params.row as any as Row;
        const readOnly =
          (row.program_status_name || '').toLowerCase() !== 'active';
        return (
          <ScheduleStatusChip
            completed_flag={row.completed_flag}
            onStatusChange={(newValue) => handleStatusChange(row, newValue)}
            readOnly={readOnly}
          />
        );
      },
    },
    {
      field: 'role_name',
      headerName: 'Responsible',
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
    { field: 'updated_by', headerName: 'Updated By' } as any,
    {
      field: 'updated_at',
      headerName: 'Updated Date',
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
          const completedFlag = (row as any).completed_flag;
          // If decision made (not null), no color - item is resolved
          if (completedFlag !== null) return '';
          
          // Only pending items (null) get date-based coloring
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
