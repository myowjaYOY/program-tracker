'use client';

import React from 'react';
import { Box, Chip } from '@mui/material';
import BaseDataTable from '@/components/tables/base-data-table';
import type { GridColDef } from '@mui/x-data-grid-pro';
import { MemberPrograms } from '@/types/database.types';
import { useMemberProgramItems } from '@/lib/hooks/use-member-program-items';
import { formatCurrency } from '@/lib/utils/money';

interface DashboardProgramItemsTabProps {
  program: MemberPrograms;
}

export default function DashboardProgramItemsTab({ program }: DashboardProgramItemsTabProps) {
  const { data: programItems = [], isLoading, error } = useMemberProgramItems(
    program.member_program_id
  );

  const rows = (programItems || []).map((item: any) => ({
    ...item,
    id: item.member_program_item_id,
    therapy_type_name: item.therapies?.therapytype?.therapy_type_name || 'N/A',
    therapy_name: item.therapies?.therapy_name || 'Unknown Therapy',
    bucket_name: item.therapies?.buckets?.bucket_name || 'N/A',
    therapy_cost: item.therapies?.cost || 0,
    therapy_charge: item.therapies?.charge || 0,
    therapy_taxable: (item.therapies as any)?.taxable || false,
    total_cost: (item.item_cost || 0) * (item.quantity || 1),
    total_charge: (item.item_charge || 0) * (item.quantity || 1),
  }));

  const cols: GridColDef[] = [
    { field: 'therapy_type_name', headerName: 'Therapy Type' },
    { field: 'therapy_name', headerName: 'Therapy Name' },
    {
      field: 'quantity',
      headerName: 'Quantity',
      type: 'number',
      renderCell: (params: any) => {
        const total = Number(params.value || 0);
        const used = Number(params.row.used_count || 0);
        const color = used === 0 ? 'default' : used < total ? 'success' : 'error';
        const title = used === 0 ? 'No items used' : `${used} of ${total} used`;
        return (
          <Chip
            label={`${total}`}
            color={color as any}
            size="small"
            variant={color === 'default' ? 'outlined' : 'filled'}
            title={title}
          />
        );
      },
    },
    { field: 'instructions', headerName: 'Instructions' },
  ];

  return (
    <Box>
      <BaseDataTable
        title=""
        data={rows}
        columns={cols}
        loading={isLoading}
        error={error ? (error as any).message : null}
        getRowId={(row: any) => row.member_program_item_id}
        showCreateButton={false}
        showActionsColumn={false}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
        sortModel={[{ field: 'therapy_name', sort: 'asc' }]}
        enableExport={true}
        persistStateKey="dashboardProgramItemsGrid"
      />
    </Box>
  );
}


