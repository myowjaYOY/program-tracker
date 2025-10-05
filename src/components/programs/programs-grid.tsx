'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
  renderActiveFlag,
} from '@/components/tables/base-data-table';
import AddProgramWizard from './add-program-wizard';
import {
  useMemberPrograms,
  useDeleteMemberProgram,
} from '@/lib/hooks/use-member-programs';
import { MemberPrograms } from '@/types/database.types';
import { MemberProgramFormData } from '@/lib/validations/member-program';

// Extend MemberPrograms to satisfy BaseEntity interface
interface MemberProgramEntity
  extends Omit<MemberPrograms, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// Member Program-specific columns
const memberProgramColumns: GridColDef[] = [
  {
    field: 'program_template_name',
    headerName: 'Program Name',
    flex: 1,
    minWidth: 240,
    renderCell: (params: any) => (
      <span
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={params.value}
      >
        {params.value}
      </span>
    ),
  },
  {
    field: 'lead_name',
    headerName: 'Member',
    width: 200,
    renderCell: (params: any) => {
      const leadName = params.row.lead_name;
      if (leadName == null || leadName === undefined || leadName === '') {
        return '-';
      }
      return leadName;
    },
  },
  {
    field: 'status_name',
    headerName: 'Status',
    width: 150,
    renderCell: (params: any) => {
      const statusName = params.row.status_name;
      if (statusName == null || statusName === undefined || statusName === '') {
        return '-';
      }
      return statusName;
    },
  },
  {
    field: 'start_date',
    headerName: 'Start Date',
    width: 120,
    renderCell: (params: any) => {
      const value = params.row.start_date;
      if (value == null || value === undefined || value === '') {
        return '-';
      }
      return new Date(value).toLocaleDateString();
    },
  },
  {
    field: 'total_cost',
    headerName: 'Cost',
    width: 120,
    type: 'number',
    renderCell: (params: any) => {
      const value = params.row.total_cost;
      if (value == null || value === undefined || value === '') {
        return '-';
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value));
    },
  },
  {
    field: 'total_charge',
    headerName: 'Charge',
    width: 120,
    type: 'number',
    renderCell: (params: any) => {
      const value = params.row.total_charge;
      if (value == null || value === undefined || value === '') {
        return '-';
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value));
    },
  },
  {
    field: 'final_total_price',
    headerName: 'Program Price',
    width: 140,
    type: 'number',
    renderCell: (params: any) => {
      const value = params.row.final_total_price;
      if (value == null || value === undefined || value === '') {
        return '-';
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value));
    },
  },
  {
    field: 'margin',
    headerName: 'Margin',
    width: 100,
    type: 'number',
    renderCell: (params: any) => {
      const value = params.row.margin;
      if (value == null || value === undefined || value === '') {
        return '-';
      }
      return `${Number(value).toFixed(1)}%`;
    },
  },
  {
    field: 'active_flag',
    headerName: 'Flag',
    width: 120,
    renderCell: renderActiveFlag,
  },
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

interface ProgramsGridProps {
  onProgramSelect: (program: MemberPrograms | null) => void;
  selectedProgram: MemberPrograms | null;
}

export default function ProgramsGrid({
  onProgramSelect,
  selectedProgram,
}: ProgramsGridProps) {
  const { data: programs, isLoading, error } = useMemberPrograms();
  const deleteProgram = useDeleteMemberProgram();

  const handleDelete = (id: string | number) => {
    deleteProgram.mutate(Number(id));
  };

  const handleEdit = (_row: MemberProgramEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const renderProgramForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<MemberProgramEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // For create mode, use the wizard
    if (mode === 'create') {
      return (
        <AddProgramWizard open={open} onClose={onClose} onSuccess={onClose} />
      );
    }

    // For edit mode, we'll need to create a separate edit form later
    // For now, just return null to prevent errors
    return null;
  };

  // Transform programs data to include id property and handle null dates
  const programsWithId: MemberProgramEntity[] = (programs || []).map(
    program => ({
      ...program,
      id: program.member_program_id,
      created_at: program.created_at || new Date().toISOString(),
      updated_at: program.updated_at || new Date().toISOString(),
      // Use the proper user email fields from the API joins (following vendors pattern)
      created_by: program.created_by_email || '-',
      updated_by: program.updated_by_email || '-',
    })
  );

  const handleRowClick = (row: MemberProgramEntity) => {
    // Convert MemberProgramEntity back to MemberPrograms for selection
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
      columns={memberProgramColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.member_program_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onRowClick={handleRowClick}
      renderForm={renderProgramForm}
      createButtonText="Add Program"
      editButtonText="Edit Program"
      deleteButtonText="Delete Program"
      deleteConfirmMessage="Are you sure you want to delete this program? This action cannot be undone."
      pageSize={5}
      pageSizeOptions={[5, 10, 25, 50]}
      autoHeight={true}
      selectedRowId={selectedProgram?.member_program_id || null}
      showActionsColumn={false}
      sortModel={[{ field: 'program_template_name', sort: 'asc' }]}
    />
  );
}
