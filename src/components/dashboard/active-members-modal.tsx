'use client';

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Tooltip,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import StarIcon from '@mui/icons-material/Star';
import CheckIcon from '@mui/icons-material/Check';
import BaseDataTable from '@/components/tables/base-data-table';
import { useActiveMembers, ActiveMember } from '@/lib/hooks/use-active-members';
import type { GridColDef } from '@mui/x-data-grid-pro';

interface ActiveMembersModalProps {
  open: boolean;
  onClose: () => void;
}

interface ActiveMemberRow extends ActiveMember {
  id: number;
  full_name: string;
  end_date: string | null;
  days_since_start: number;
  is_new: boolean;
}

/**
 * Calculate end date based on start date + duration (in days)
 * Returns ISO date string for proper sorting
 */
function calculateEndDate(startDate: string | null, duration: number | null): string | null {
  if (!startDate || !duration) return null;
  
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + duration);
  
  // Return ISO date string (YYYY-MM-DD) for proper sorting
  return end.toISOString().split('T')[0] || null;
}

/**
 * Calculate days since start date
 */
function calculateDaysSinceStart(startDate: string | null): number {
  if (!startDate) return 999;
  
  const start = new Date(startDate);
  const today = new Date();
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Format date for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

export default function ActiveMembersModal({ open, onClose }: ActiveMembersModalProps) {
  const { data: members = [], isLoading, error } = useActiveMembers();

  // Transform data for grid
  const rows: ActiveMemberRow[] = useMemo(() => {
    return members.map((member) => {
      const daysSinceStart = calculateDaysSinceStart(member.start_date);
      
      return {
        ...member,
        id: member.lead_id,
        full_name: `${member.first_name} ${member.last_name}`,
        end_date: calculateEndDate(member.start_date, member.duration),
        days_since_start: daysSinceStart,
        is_new: daysSinceStart <= 7,
      };
    });
  }, [members]);

  // Define columns
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'full_name',
      headerName: 'Name',
      width: 250,
      renderCell: (params: any) => {
        const isNew = params.row.is_new;
        const daysAgo = params.row.days_since_start;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isNew && (
              <Tooltip title={`Started ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`} arrow>
                <StarIcon sx={{ color: 'warning.main', fontSize: 18 }} />
              </Tooltip>
            )}
            <Typography variant="body2">{params.value}</Typography>
          </Box>
        );
      },
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 280,
    },
    {
      field: 'start_date',
      headerName: 'Start Date',
      width: 140,
      valueFormatter: (value: any) => formatDate(value),
    },
    {
      field: 'end_date',
      headerName: 'End Date',
      width: 140,
      renderCell: (params: any) => {
        const endDate = params.value;
        if (!endDate) return <Typography variant="body2">N/A</Typography>;
        
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        const isPastDue = end < today;
        
        return (
          <Typography 
            variant="body2" 
            sx={{ 
              color: isPastDue ? 'error.main' : 'inherit',
              fontWeight: isPastDue ? 600 : 400,
            }}
          >
            {formatDate(endDate)}
          </Typography>
        );
      },
      valueFormatter: (value: any) => formatDate(value), // For CSV export
    },
    {
      field: 'has_coach',
      headerName: 'Coach',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: any) => {
        return params.value ? (
          <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
        ) : null;
      },
      valueFormatter: (value: any) => value ? '✓' : '', // For CSV export
    },
  ], []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          width: '1000px',
          maxWidth: '95vw',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Typography variant="h6" component="div">
          Active Members ({rows.length})
        </Typography>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <BaseDataTable
          title=""
          data={rows}
          columns={columns}
          loading={isLoading}
          error={error?.message ?? null}
          getRowId={(row: ActiveMemberRow) => row.lead_id}
          showCreateButton={false}
          showActionsColumn={false}
          pageSize={25}
          pageSizeOptions={[25, 50, 100]}
          sortModel={[{ field: 'full_name', sort: 'asc' }]}
          enableExport={true}
          gridHeight={500}
          autoHeight={false}
        />
      </DialogContent>
    </Dialog>
  );
}

