'use client';

import React, { useState } from 'react';
import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import {
  useCoordinatorToDo,
  coordinatorKeys,
} from '@/lib/hooks/use-coordinator';
import { useQueryClient } from '@tanstack/react-query';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { LeadNotesModal } from '@/components/notes';
import TaskStatusToggle from '@/components/ui/task-status-toggle';
import { toast } from 'sonner';

interface CoordinatorToDoTabProps {
  memberId?: number | null;
  range?: 'all' | 'today' | 'week' | 'month' | 'custom';
  start?: string | undefined;
  end?: string | undefined;
  showCompleted?: boolean;
  showMissed?: boolean;
}

export default function CoordinatorToDoTab({
  memberId = null,
  range = 'all',
  start,
  end,
  showCompleted = false,
  showMissed = false,
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
    showCompleted,
    showMissed,
  });
  const qc = useQueryClient();

  // Notes modal state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const handleOpenNotesModal = (leadId: number, memberName: string) => {
    setSelectedLead({ id: leadId, name: memberName });
    setIsNotesModalOpen(true);
  };

  const handleCloseNotesModal = () => {
    setIsNotesModalOpen(false);
    setSelectedLead(null);
    // Invalidate todo query to refresh note counts
    const sp = new URLSearchParams();
    if (memberId) sp.set('memberId', String(memberId));
    if (range && range !== 'all') sp.set('range', range);
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    if (showCompleted) sp.set('showCompleted', 'true');
    if (showMissed) sp.set('showMissed', 'true');
    qc.invalidateQueries({
      queryKey: coordinatorKeys.todo(sp.toString()),
    });
  };

  async function handleStatusChange(row: any, newValue: boolean | null): Promise<void> {
    // Generate query key exactly the same way as the hook
    const sp = new URLSearchParams();
    if (memberId) sp.set('memberId', String(memberId));
    if (range && range !== 'all') sp.set('range', range);
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    if (showCompleted) sp.set('showCompleted', 'true');
    if (showMissed) sp.set('showMissed', 'true');
    const qs = sp.toString();
    const queryKey = coordinatorKeys.todo(qs);

    // Optimistic update - immediately update the UI
    qc.setQueryData(queryKey, (oldData: any) => {
      if (!oldData) return oldData;
      
      // If showing completed tasks, just update the value (never remove)
      if (showCompleted) {
        return oldData.map((item: any) => 
          item.member_program_item_task_schedule_id === row.member_program_item_task_schedule_id
            ? { ...item, completed_flag: newValue }
            : item
        );
      }
      
      // If showMissed is false (default), we're only showing pending items
      if (!showMissed) {
        // Only showing pending - if changing to anything other than null, remove it
        if (newValue !== null) {
          return oldData.filter((item: any) => 
            item.member_program_item_task_schedule_id !== row.member_program_item_task_schedule_id
          );
        } else {
          // Changing back to pending - keep it
          return oldData.map((item: any) => 
            item.member_program_item_task_schedule_id === row.member_program_item_task_schedule_id
              ? { ...item, completed_flag: newValue }
              : item
          );
        }
      }
      
      // Default: showing pending + missed (not completed)
      if (newValue === true) {
        // Marking as redeemed - remove from list
        return oldData.filter((item: any) => 
          item.member_program_item_task_schedule_id !== row.member_program_item_task_schedule_id
        );
      } else {
        // Marking as missed or pending - update value (item stays in list)
        return oldData.map((item: any) => 
          item.member_program_item_task_schedule_id === row.member_program_item_task_schedule_id
            ? { ...item, completed_flag: newValue }
            : item
        );
      }
    });

    try {
      const url = `/api/member-programs/${row.member_program_id}/todo/${row.member_program_item_task_schedule_id}`;
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

  let rows = (data as any[]).map(r => {
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
      role_name: r.program_role?.role_name || null,
      role_display_color: r.program_role?.display_color || null,
      created_by: r.created_by_full_name ?? r.created_by_email ?? r.created_by ?? '-',
      updated_by: r.updated_by_full_name ?? r.updated_by_email ?? r.updated_by ?? '-',
    };
  });

  const cols: GridColDef[] = [
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
      field: 'due_date',
      headerName: 'Due',
      renderCell: renderDate as any,
    },
    { field: 'therapy_type', headerName: 'Therapy Type' },
    { field: 'therapy_name', headerName: 'Therapy' },
    { field: 'task_name', headerName: 'Task' },
    { field: 'description', headerName: 'Description' },
    {
      field: 'instance_number',
      headerName: 'Instance',
      type: 'number',
      width: 80,
    },
    {
      field: 'completed_flag',
      headerName: 'Status',
      width: 140,
      renderCell: params => {
        const row: any = params.row;
        const readOnly =
          (row.program_status_name || '').toLowerCase() !== 'active';
        return (
          <TaskStatusToggle
            completed_flag={row.completed_flag}
            onStatusChange={(newValue) => handleStatusChange(row, newValue)}
            readOnly={readOnly}
            showLabel={true}
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
        data={rows}
        columns={cols}
        loading={isLoading}
        error={error ? (error as any).message : null}
        getRowId={row => row.member_program_item_task_schedule_id}
        persistStateKey="coordinatorToDoGrid"
        rowClassName={(row: any) => {
          const completedFlag = row?.completed_flag;
          // If decision made (not null), no color - item is resolved
          if (completedFlag !== null) return '';
          
          // Only pending items (null) get late highlighting
          const dateStr = row?.due_date as string | undefined;
          if (!dateStr) return '';
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          // Parse as local time by appending T00:00:00
          const date = new Date(dateStr + 'T00:00:00');
          const diffDays = Math.floor(
            (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return diffDays < 0 ? 'row-late' : '';
        }}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
        enableExport={true}
        sortModel={[{ field: 'due_date', sort: 'asc' }]}
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
