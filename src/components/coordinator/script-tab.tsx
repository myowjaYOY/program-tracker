'use client';

import React, { useState } from 'react';
import { Box, IconButton, Chip, Tooltip, Typography } from '@mui/material';
import BaseDataTable, { renderDate } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import {
  useCoordinatorScript,
  coordinatorKeys,
} from '@/lib/hooks/use-coordinator';
import { useQueryClient } from '@tanstack/react-query';
import { LeadNotesModal } from '@/components/notes';
import ScheduleStatusChip from '@/components/ui/schedule-status-chip';
import ScheduleAdjustmentModal from '@/components/modals/schedule-adjustment-modal';
import DateChangeModal from '@/components/modals/date-change-modal';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface CoordinatorScriptTabProps {
  memberId?: number | null;
  range?: 'all' | 'today' | 'week' | 'month' | 'custom';
  start?: string | undefined;
  end?: string | undefined;
  showCompleted?: boolean;
  showMissed?: boolean;
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
  showMissed = false,
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
    showMissed,
  });
  const qc = useQueryClient();

  // Notes modal state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Schedule adjustment modal state
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentPromptData, setAdjustmentPromptData] = useState<{
    scheduledDate?: string;
    redemptionDate?: string;
    futureInstanceCount: number;
    itemDetails?: {
      therapyName?: string;
      instanceNumber?: number;
      daysBetween?: number;
    };
  } | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    row: Row;
    newValue: boolean | null;
    redemptionDate?: string;
  } | null>(null);
  const [isProcessingAdjustment, setIsProcessingAdjustment] = useState(false);

  // Date change modal state (calendar icon feature)
  const [isDateChangeModalOpen, setIsDateChangeModalOpen] = useState(false);
  const [dateChangeRow, setDateChangeRow] = useState<Row | null>(null);
  const [dateChangeFutureCount, setDateChangeFutureCount] = useState(0);
  const [dateChangeItemDetails, setDateChangeItemDetails] = useState<{
    therapyName?: string;
    instanceNumber?: number;
    daysBetween?: number;
  } | undefined>(undefined);
  const [isLoadingDateChange, setIsLoadingDateChange] = useState(false);
  const [isProcessingDateChange, setIsProcessingDateChange] = useState(false);

  async function handleStatusChange(row: Row, newValue: boolean | null): Promise<void> {
    // Generate query key exactly the same way as the hook
    const sp = new URLSearchParams();
    if (memberId) sp.set('memberId', String(memberId));
    if (range && range !== 'all') sp.set('range', range);
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    if (showCompleted) sp.set('showCompleted', 'true');
    if (showMissed) sp.set('showMissed', 'true');
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
      
      // If showMissed is false (default), we're only showing pending items
      if (!showMissed) {
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
      const redemptionDate = new Date().toISOString().split('T')[0];
      const url = `/api/member-programs/${row.member_program_id}/schedule/${row.member_program_item_schedule_id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          completed_flag: newValue,
          redemption_date: redemptionDate,
        }),
      });
      
      // Check for 409 Conflict (prompt required for schedule adjustment)
      if (res.status === 409) {
        const data = await res.json();
        if (data.prompt_required && data.needsPrompt) {
          // Revert optimistic update
          qc.invalidateQueries({ queryKey });
          
          // Show modal
          setAdjustmentPromptData({
            scheduledDate: data.scheduledDate,
            redemptionDate: data.redemptionDate,
            futureInstanceCount: data.futureInstanceCount,
            itemDetails: data.itemDetails,
          });
          const pendingChange: { row: Row; newValue: boolean | null; redemptionDate?: string } = { row, newValue };
          if (redemptionDate) {
            pendingChange.redemptionDate = redemptionDate;
          }
          setPendingStatusChange(pendingChange);
          setIsAdjustmentModalOpen(true);
          return;
        }
      }
      
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

  // Handle schedule adjustment confirmation from modal
  async function handleAdjustmentConfirm(adjust: boolean) {
    if (!pendingStatusChange) return;

    setIsProcessingAdjustment(true);

    const { row, newValue, redemptionDate } = pendingStatusChange;
    const sp = new URLSearchParams();
    if (memberId) sp.set('memberId', String(memberId));
    if (range && range !== 'all') sp.set('range', range);
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    if (showCompleted) sp.set('showCompleted', 'true');
    if (showMissed) sp.set('showMissed', 'true');
    const qs = sp.toString();
    const queryKey = coordinatorKeys.script(qs);

    try {
      const url = `/api/member-programs/${row.member_program_id}/schedule/${row.member_program_item_schedule_id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          completed_flag: newValue,
          confirm_cascade: true,
          adjust_schedule: adjust,
          redemption_date: redemptionDate,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to update schedule');
        setIsProcessingAdjustment(false);
        return;
      }

      const result = await res.json();

      // Show success message with cascade info
      if (adjust && result.cascade) {
        const { updated_instances, updated_tasks } = result.cascade;
        toast.success(
          `Schedule adjusted! Updated ${updated_instances} future instance${updated_instances !== 1 ? 's' : ''} ` +
          `and ${updated_tasks} task${updated_tasks !== 1 ? 's' : ''}.`
        );
      } else {
        toast.success('Status updated successfully');
      }

      // Invalidate queries to refresh data
      await qc.invalidateQueries({ queryKey, refetchType: 'active' });
      await qc.invalidateQueries({ queryKey: coordinatorKeys.metrics(), refetchType: 'active' });

      // Close modal and reset state
      setIsAdjustmentModalOpen(false);
      setAdjustmentPromptData(null);
      setPendingStatusChange(null);
      setIsProcessingAdjustment(false);
    } catch (error) {
      console.error('Error confirming schedule adjustment:', error);
      toast.error('Failed to update schedule');
      setIsProcessingAdjustment(false);
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
    if (showMissed) sp.set('showMissed', 'true');
    qc.invalidateQueries({
      queryKey: coordinatorKeys.script(sp.toString()),
    });
  };

  // Handle opening date change modal (calendar icon click)
  async function handleOpenDateChangeModal(row: Row) {
    // Only allow for pending items on active programs
    if (row.completed_flag !== null) {
      toast.error('Cannot change date for completed or missed items');
      return;
    }
    if ((row.program_status_name || '').toLowerCase() !== 'active') {
      toast.error('Cannot change date for items on inactive programs');
      return;
    }

    setIsLoadingDateChange(true);
    setDateChangeRow(row);

    try {
      // Fetch future instance count and item details
      const url = `/api/member-programs/${row.member_program_id}/schedule/${row.member_program_item_schedule_id}/future-count`;
      const res = await fetch(url, { credentials: 'include' });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch schedule details');
      }

      const data = await res.json();
      setDateChangeFutureCount(data.futureInstanceCount || 0);
      setDateChangeItemDetails(data.itemDetails);
      setIsDateChangeModalOpen(true);
    } catch (err: any) {
      console.error('Error fetching future count:', err);
      toast.error(err.message || 'Failed to load schedule details');
      setDateChangeRow(null);
    } finally {
      setIsLoadingDateChange(false);
    }
  }

  // Handle date change confirmation from modal
  async function handleDateChangeConfirm(newDate: string, adjustFuture: boolean) {
    if (!dateChangeRow) return;

    setIsProcessingDateChange(true);

    const sp = new URLSearchParams();
    if (memberId) sp.set('memberId', String(memberId));
    if (range && range !== 'all') sp.set('range', range);
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    if (showCompleted) sp.set('showCompleted', 'true');
    if (showMissed) sp.set('showMissed', 'true');
    const queryKey = coordinatorKeys.script(sp.toString());

    try {
      const url = `/api/member-programs/${dateChangeRow.member_program_id}/schedule/${dateChangeRow.member_program_item_schedule_id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scheduled_date: newDate,
          adjust_future: adjustFuture,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to change date');
      }

      const result = await res.json();

      // Show success message
      if (adjustFuture && result.cascade) {
        const { updated_instances, updated_tasks } = result.cascade;
        toast.success(
          `Date changed! Updated ${updated_instances} future instance${updated_instances !== 1 ? 's' : ''} ` +
          `and ${updated_tasks} task${updated_tasks !== 1 ? 's' : ''}.`
        );
      } else {
        toast.success('Scheduled date updated successfully');
      }

      // Refresh data
      await qc.invalidateQueries({ queryKey, refetchType: 'active' });
      await qc.invalidateQueries({ queryKey: coordinatorKeys.metrics(), refetchType: 'active' });

      // Close modal and reset state
      setIsDateChangeModalOpen(false);
      setDateChangeRow(null);
      setDateChangeFutureCount(0);
      setDateChangeItemDetails(undefined);
    } catch (err: any) {
      console.error('Error changing date:', err);
      toast.error(err.message || 'Failed to change date');
    } finally {
      setIsProcessingDateChange(false);
    }
  }

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
      minWidth: 140,
      renderCell: (params) => {
        const row = params.row as Row;
        const dateStr = row.scheduled_date;
        const isPending = row.completed_flag === null;
        const isActive = (row.program_status_name || '').toLowerCase() === 'active';
        const canChangeDate = isPending && isActive;
        
        let dateDisplay = '-';
        if (dateStr) {
          try {
            dateDisplay = format(parseISO(dateStr), 'MMM d, yyyy');
          } catch {
            dateDisplay = dateStr;
          }
        }

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {canChangeDate && (
              <Tooltip title="Change scheduled date">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDateChangeModal(row);
                  }}
                  disabled={isLoadingDateChange && dateChangeRow?.member_program_item_schedule_id === row.member_program_item_schedule_id}
                  sx={{
                    p: 0.25,
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'primary.main',
                      backgroundColor: 'primary.50',
                    },
                  }}
                >
                  <CalendarTodayIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
              {dateDisplay}
            </Typography>
          </Box>
        );
      },
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
          
          // Only pending items (null) get late highlighting
          const dateStr = (row as any).scheduled_date as string | undefined;
          if (!dateStr) return '';
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          // Parse as local time by appending T00:00:00
          const date = new Date(dateStr + 'T00:00:00');
          const diffDays = Math.floor(
            (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return diffDays <= 0 ? 'row-late' : '';
        }}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
        enableExport={true}
        sortModel={[{ field: 'scheduled_date', sort: 'asc' }]}
      />

      {/* Schedule Adjustment Modal */}
      <ScheduleAdjustmentModal
        open={isAdjustmentModalOpen}
        onClose={() => {
          setIsAdjustmentModalOpen(false);
          setAdjustmentPromptData(null);
          setPendingStatusChange(null);
        }}
        promptData={adjustmentPromptData}
        onConfirm={handleAdjustmentConfirm}
        loading={isProcessingAdjustment}
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

      {/* Date Change Modal */}
      {dateChangeRow && (
        <DateChangeModal
          open={isDateChangeModalOpen}
          onClose={() => {
            setIsDateChangeModalOpen(false);
            setDateChangeRow(null);
            setDateChangeFutureCount(0);
            setDateChangeItemDetails(undefined);
          }}
          currentDate={dateChangeRow.scheduled_date}
          futureInstanceCount={dateChangeFutureCount}
          itemDetails={dateChangeItemDetails}
          onConfirm={handleDateChangeConfirm}
          loading={isProcessingDateChange}
        />
      )}
    </Box>
  );
}
