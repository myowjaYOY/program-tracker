'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import ProgramStatusForm from '@/components/forms/program-status-form';
import {
  useProgramStatus,
  useDeleteProgramStatus,
} from '@/lib/hooks/use-program-status';
import { ProgramStatus } from '@/types/database.types';
import { ProgramStatusFormData } from '@/lib/validations/program-status';

interface ProgramStatusEntity
  extends Omit<ProgramStatus, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

const programStatusColumns: GridColDef[] = [
  {
    field: 'program_status_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'status_name',
    headerName: 'Status Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 250,
    flex: 1,
  },
  commonColumns.activeFlag,
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

export default function ProgramStatusTable() {
  const { data: programStatuses, isLoading, error } = useProgramStatus();
  const deleteProgramStatus = useDeleteProgramStatus();

  const handleDelete = (id: string | number) => {
    deleteProgramStatus.mutate(String(id));
  };

  const handleEdit = (_row: ProgramStatusEntity) => {
    // Edit handled by BaseDataTable modal
  };

  const renderProgramStatusForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<ProgramStatusEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formData: Partial<ProgramStatusFormData> & {
      program_status_id?: number;
    } = initialValues
      ? {
          status_name: initialValues.status_name || '',
          description: initialValues.description || '',
          active_flag: initialValues.active_flag ?? true,
          ...(initialValues.program_status_id && {
            program_status_id: initialValues.program_status_id,
          }),
        }
      : {};
    return (
      <ProgramStatusForm
        initialValues={formData}
        onSuccess={onClose}
        mode={mode}
      />
    );
  };

  const programStatusesWithId: ProgramStatusEntity[] = (
    programStatuses || []
  ).map(programStatus => ({
    ...programStatus,
    id: programStatus.program_status_id,
    created_at: programStatus.created_at || new Date().toISOString(),
    updated_at: programStatus.updated_at || new Date().toISOString(),
    created_by: programStatus.created_by_email || '-',
    updated_by: programStatus.updated_by_email || '-',
  }));

  return (
    <BaseDataTable<ProgramStatusEntity>
      title="Program Status"
      data={programStatusesWithId}
      columns={programStatusColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.program_status_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderProgramStatusForm}
      persistStateKey="programStatusGrid"
      createButtonText="Add Program Status"
      editButtonText="Edit Program Status"
      deleteButtonText="Delete Program Status"
      deleteConfirmMessage="Are you sure you want to delete this program status? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
