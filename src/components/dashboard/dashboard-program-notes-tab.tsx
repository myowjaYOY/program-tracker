'use client';

import React from 'react';
import { Box, Button, Tooltip, Chip, Typography } from '@mui/material';
import {
  Add as AddIcon,
  NotificationsActive as AlertIcon,
  CheckCircle as AcknowledgedIcon,
} from '@mui/icons-material';
import BaseDataTable, { renderDateTime } from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms } from '@/types/database.types';
import { useLeadNotes } from '@/lib/hooks/use-lead-notes';
import { LeadNotesModal } from '@/components/notes';

interface DashboardProgramNotesTabProps {
  program: MemberPrograms | null;
  memberId?: number | null;
}

const getNoteTypeColor = (noteType: string) => {
  switch (noteType) {
    case 'PME':
      return 'primary';
    case 'Win':
      return 'success';
    case 'Challenge':
      return 'error';
    case 'Follow-Up':
      return 'info';
    case 'Other':
    default:
      return 'default';
  }
};

export default function DashboardProgramNotesTab({ program, memberId = null }: DashboardProgramNotesTabProps) {
  const leadId = memberId ?? program?.lead_id ?? null;
  const leadName = program?.lead_name || '';

  const { data, isLoading, error } = useLeadNotes(leadId || 0) as any;
  const rows = (data?.data || []).map((n: any) => ({
    ...n,
    id: n.note_id,
  }));

  const cols: GridColDef[] = [
    {
      field: 'created_at',
      headerName: 'Date/Time',
      width: 200,
      renderCell: (params: any) => {
        const isSource = params.row.is_alert_source;
        const isResponse = params.row.is_alert_response;
        const alertId = params.row.alert_id;
        const alertRoles = params.row.alert_roles;
        const rolesText = alertRoles?.join(', ') || '';
        
        const dateContent = renderDateTime(params);
        
        if (isSource && alertId) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={`Alert #${alertId} (${rolesText})`}>
                <AlertIcon sx={{ color: 'warning.main', fontSize: 18 }} />
              </Tooltip>
              {dateContent}
            </Box>
          );
        }
        if (isResponse && alertId) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={`Alert #${alertId} (${rolesText})`}>
                <AcknowledgedIcon sx={{ color: 'success.main', fontSize: 18 }} />
              </Tooltip>
              {dateContent}
            </Box>
          );
        }
        return dateContent;
      },
      sortable: true,
    },
    {
      field: 'note_type',
      headerName: 'Type',
      width: 120,
      renderCell: (params: any) => (
        <Chip
          label={params.value}
          size="small"
          color={getNoteTypeColor(params.value) as any}
          variant="outlined"
        />
      ),
      sortable: true,
    },
    {
      field: 'note',
      headerName: 'Content',
      flex: 1,
      minWidth: 300,
      renderCell: (params: any) => (
        <Typography
          variant="body2"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.2,
          }}
          title={params.value}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'created_by_name',
      headerName: 'Created By',
      width: 200,
      renderCell: (params: any) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || 'System'}
        </Typography>
      ),
    },
  ];

  const [open, setOpen] = React.useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
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
