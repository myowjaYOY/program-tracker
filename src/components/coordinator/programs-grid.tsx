'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  renderActiveFlag,
} from '@/components/tables/base-data-table';
import { useMemberPrograms } from '@/lib/hooks/use-member-programs';
import { MemberPrograms } from '@/types/database.types';

interface MemberProgramEntity
  extends Omit<MemberPrograms, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

const columns: GridColDef[] = [
  { field: 'lead_name', headerName: 'Member', width: 200 },
  {
    field: 'program_template_name',
    headerName: 'Program Name',
    flex: 1,
    minWidth: 240,
  },
  { field: 'status_name', headerName: 'Status', width: 150 },
  {
    field: 'start_date',
    headerName: 'Start Date',
    width: 140,
    renderCell: (params: any) => {
      const value = params.value;
      if (!value) return '-';
      // Handle date-only strings (YYYY-MM-DD) to avoid UTC timezone shift
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parts = value.split('-').map(Number) as [number, number, number];
        const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
        return localDate.toLocaleDateString('en-US');
      }
      return new Date(value).toLocaleDateString('en-US');
    },
  },
  {
    field: 'created_at',
    headerName: 'Created Date',
    width: 140,
    renderCell: (params: any) =>
      params.value ? new Date(params.value).toLocaleDateString() : '-',
  },
  { field: 'created_by', headerName: 'Created By', width: 180 },
  {
    field: 'updated_at',
    headerName: 'Updated Date',
    width: 140,
    renderCell: (params: any) =>
      params.value ? new Date(params.value).toLocaleDateString() : '-',
  },
  { field: 'updated_by', headerName: 'Updated By', width: 180 },
];

interface CoordinatorProgramsGridProps {
  onProgramSelect: (program: MemberPrograms | null) => void;
  selectedProgram: MemberPrograms | null;
}

export default function CoordinatorProgramsGrid({
  onProgramSelect,
  selectedProgram,
}: CoordinatorProgramsGridProps) {
  const { data: programs, isLoading, error } = useMemberPrograms();

  const programsWithId: MemberProgramEntity[] = (programs || []).map(
    program => ({
      ...program,
      id: program.member_program_id,
      created_at: program.created_at || new Date().toISOString(),
      updated_at: program.updated_at || new Date().toISOString(),
      created_by: program.created_by_email || '-',
      updated_by: program.updated_by_email || '-',
    })
  );

  const handleRowClick = (row: MemberProgramEntity) => {
    const program: MemberPrograms = {
      member_program_id: row.member_program_id,
      program_template_name: row.program_template_name,
      description: row.description,
      total_cost: row.total_cost,
      total_charge: row.total_charge,
      lead_id: row.lead_id,
      start_date: row.start_date,
      duration: row.duration || 30,
      active_flag: row.active_flag,
      program_status_id: row.program_status_id,
      source_template_id: row.source_template_id,
      template_version_date: row.template_version_date,
      created_at: row.created_at,
      created_by: row.created_by,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
      created_by_email: row.created_by_email || null,
      created_by_full_name: row.created_by_full_name || null,
      updated_by_email: row.updated_by_email || null,
      updated_by_full_name: row.updated_by_full_name || null,
      lead_email: row.lead_email || null,
      lead_name: row.lead_name || null,
      template_name: row.template_name || null,
      status_name: row.status_name || null,
    };
    onProgramSelect(program);
  };

  return (
    <BaseDataTable<MemberProgramEntity>
      title="Programs"
      data={programsWithId}
      columns={columns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.member_program_id}
      onRowClick={handleRowClick}
      showActionsColumn={false}
      persistStateKey="coordinatorProgramsGrid"
      pageSize={5}
      pageSizeOptions={[5, 10, 25, 50]}
      autoHeight={true}
      selectedRowId={selectedProgram?.member_program_id || null}
    />
  );
}
