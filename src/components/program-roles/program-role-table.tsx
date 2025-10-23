'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import ProgramRoleForm from '@/components/forms/program-role-form';
import {
  useProgramRoles,
  useDeleteProgramRole,
} from '@/lib/hooks/use-program-roles';
import { ProgramRoles } from '@/types/database.types';
import { ProgramRolesFormData } from '@/lib/validations/program-roles';

// Extend ProgramRoles to satisfy BaseEntity interface
interface ProgramRoleEntity
  extends Omit<ProgramRoles, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// Program role-specific columns
const programRoleColumns: GridColDef[] = [
  {
    field: 'program_role_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'role_name',
    headerName: 'Role Name',
    width: 180,
    flex: 1,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 300,
    flex: 2,
  },
  {
    field: 'display_color',
    headerName: 'Color',
    width: 120,
    renderCell: params => (
      <Chip
        label={params.value}
        size="small"
        sx={{
          backgroundColor: params.value,
          color: '#fff',
          fontWeight: 600,
        }}
      />
    ),
  },
  {
    field: 'display_order',
    headerName: 'Order',
    width: 100,
    type: 'number',
  },
  commonColumns.activeFlag,
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

export default function ProgramRoleTable() {
  const { data: programRoles, isLoading, error } = useProgramRoles();
  const deleteProgramRole = useDeleteProgramRole();

  const handleDelete = (id: string | number) => {
    deleteProgramRole.mutate(String(id));
  };

  const handleEdit = (_row: ProgramRoleEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const renderProgramRoleForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<ProgramRoleEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert ProgramRoleEntity to ProgramRolesFormData for the form
    const formData: Partial<ProgramRolesFormData> & { program_role_id?: number } =
      initialValues
        ? {
            role_name: initialValues.role_name || '',
            description: initialValues.description || '',
            display_color: initialValues.display_color || '#808080',
            display_order: initialValues.display_order || 0,
            active_flag: initialValues.active_flag,
            ...(initialValues.program_role_id && {
              program_role_id: initialValues.program_role_id,
            }),
          }
        : {};

    return (
      <ProgramRoleForm
        initialValues={formData}
        onSuccess={onClose}
        mode={mode}
      />
    );
  };

  // Transform program roles data to include id property and handle null dates
  const programRolesWithId: ProgramRoleEntity[] = (programRoles || []).map(
    role => ({
      ...role,
      id: role.program_role_id,
      created_at: role.created_at || new Date().toISOString(),
      updated_at: role.updated_at || new Date().toISOString(),
      created_by: role.created_by_email || '-',
      updated_by: role.updated_by_email || '-',
    })
  );

  return (
    <BaseDataTable<ProgramRoleEntity>
      title="Program Roles"
      data={programRolesWithId}
      columns={programRoleColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.program_role_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderProgramRoleForm}
      persistStateKey="programRolesGrid"
      createButtonText="Add Role"
      editButtonText="Edit Role"
      deleteButtonText="Delete Role"
      deleteConfirmMessage="Are you sure you want to delete this role? This action cannot be undone if the role is not in use."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}


