'use client';

import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Grid, Tooltip, Chip } from '@mui/material';
import {
  Group as GroupIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import BaseDataTable from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms } from '@/types/database.types';
import { useMemberProgramRashaItems } from '@/lib/hooks/use-member-program-rasha';

interface DashboardProgramRashaTabProps {
  program: MemberPrograms;
}

export default function DashboardProgramRashaTab({ program }: DashboardProgramRashaTabProps) {
  const { data: rashaItems = [], isLoading, error } = useMemberProgramRashaItems(
    program.member_program_id
  );

  // Map RASHA items to include id field for DataGrid
  const rows = rashaItems.map((item: any) => ({
    ...item,
    id: item.member_program_rasha_id,
  }));

  // Calculate group summaries (only active items)
  const groupSummaries = useMemo(() => {
    const activeItems = rashaItems.filter((item: any) => item.active_flag);
    const groups = new Map<string, { items: typeof rashaItems; totalSeconds: number }>();

    activeItems.forEach((item: any) => {
      const groupName = item.group_name || 'No Group';
      if (!groups.has(groupName)) {
        groups.set(groupName, { items: [], totalSeconds: 0 });
      }
      const group = groups.get(groupName)!;
      group.items.push(item);
      group.totalSeconds += item.rasha_length || 0;
    });

    return Array.from(groups.entries())
      .map(([name, data]) => ({
        name,
        totalSeconds: data.totalSeconds,
        items: data.items,
      }))
      .sort((a, b) => {
        if (a.name === 'No Group') return 1;
        if (b.name === 'No Group') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [rashaItems]);

  // Format seconds to HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  // Color palette for group cards
  const colorPalette = [
    '#8e24ff',
    '#0288d1',
    '#2e7d32',
    '#ed6c02',
    '#d32f2f',
    '#5a0ea4',
  ];

  const getGroupColor = (groupName: string): string => {
    if (groupName === 'No Group') return '#9e9e9e';
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) {
      hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colorPalette.length;
    return colorPalette[index]!;
  };

  // Detect type mismatches within each group
  const getTypeMismatchInfo = (item: any) => {
    if (!item.group_name) return null;

    const groupItems = rashaItems.filter(
      (i: any) => i.group_name === item.group_name && i.active_flag
    );

    if (groupItems.length <= 1) return null;

    const groupTypes = groupItems.filter((i: any) => i.type === 'group').length;
    const individualTypes = groupItems.filter((i: any) => i.type === 'individual').length;

    if (groupTypes > individualTypes && item.type === 'individual') {
      return {
        isOutlier: true,
        message: `Type mismatch: ${groupTypes} item${groupTypes !== 1 ? 's' : ''} in "${item.group_name}" are "Group" type, but this one is "Individual".`,
      };
    }

    if (groupTypes === individualTypes && item.type === 'individual') {
      return {
        isOutlier: true,
        message: `Type mismatch: Equal split in "${item.group_name}" - ${groupTypes} "Group" and ${individualTypes} "Individual".`,
      };
    }

    if (individualTypes > groupTypes && item.type === 'group') {
      return {
        isOutlier: true,
        message: `Type mismatch: ${individualTypes} item${individualTypes !== 1 ? 's' : ''} in "${item.group_name}" are "Individual" type, but this one is "Group".`,
      };
    }

    return null;
  };

  const columns: GridColDef[] = [
    {
      field: 'rasha_name',
      headerName: 'RASHA Name',
      width: 200,
      flex: 1,
    },
    {
      field: 'rasha_length',
      headerName: 'Length (sec)',
      width: 100,
      type: 'number',
    },
    {
      field: 'group_name',
      headerName: 'Group Name',
      width: 150,
      renderCell: (params: any) => params.value || '-',
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 130,
      renderCell: (params: any) => {
        const item = params.row;
        const type = params.value;
        const mismatchInfo = getTypeMismatchInfo(item);

        if (mismatchInfo?.isOutlier) {
          return (
            <Tooltip title={mismatchInfo.message} arrow>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WarningIcon sx={{ color: 'error.main', fontSize: 20 }} />
                <Typography variant="body2">
                  {type === 'group' ? 'Group' : 'Individual'}
                </Typography>
              </Box>
            </Tooltip>
          );
        }

        return type === 'group' ? 'Group' : 'Individual';
      },
    },
    {
      field: 'order_number',
      headerName: 'Order',
      width: 80,
      type: 'number',
    },
    {
      field: 'active_flag',
      headerName: 'Active',
      width: 80,
      renderCell: (params: any) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'default'}
          size="small"
          variant={params.value ? 'filled' : 'outlined'}
        />
      ),
    },
  ];

  return (
    <Box>
      {/* Group Summary Cards */}
      {groupSummaries.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            {groupSummaries.map((group) => {
              const color = getGroupColor(group.name);
              const hasGroupType = group.items.some((i: any) => i.type === 'group');
              const hasIndividualType = group.items.some((i: any) => i.type === 'individual');
              const hasMixedTypes = hasGroupType && hasIndividualType;

              return (
                <Grid key={group.name} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    sx={{
                      borderLeft: `4px solid ${color}`,
                      height: '100%',
                    }}
                  >
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {hasGroupType && !hasIndividualType && (
                          <GroupIcon sx={{ color, fontSize: 20 }} />
                        )}
                        {hasIndividualType && !hasGroupType && (
                          <PersonIcon sx={{ color, fontSize: 20 }} />
                        )}
                        {hasMixedTypes && (
                          <Tooltip title="Mixed types in this group">
                            <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                          </Tooltip>
                        )}
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {group.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {group.items.length} item{group.items.length !== 1 ? 's' : ''} •{' '}
                        {formatDuration(group.totalSeconds)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      <BaseDataTable
        title=""
        data={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as any).message : null}
        getRowId={(row: any) => row.member_program_rasha_id}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
        sortModel={[
          { field: 'group_name', sort: 'asc' },
          { field: 'order_number', sort: 'asc' },
        ]}
        enableExport={true}
        persistStateKey="dashboardProgramRashaGrid"
      />
    </Box>
  );
}
