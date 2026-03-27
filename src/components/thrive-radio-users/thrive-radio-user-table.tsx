'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Box, Typography } from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import BaseDataTable, {
  BaseEntity,
  commonColumns,
  renderPhone,
  renderDateTime,
} from '@/components/tables/base-data-table';
import ThriveRadioUserForm from '@/components/forms/thrive-radio-user-form';
import {
  useThriveRadioUsers,
  useDeleteThriveRadioUser,
} from '@/lib/hooks/use-thrive-radio-users';

interface ThriveRadioUserEntity extends BaseEntity {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  last_sign_in_at?: string | null;
}

const thriveRadioUserColumns: GridColDef[] = [
  {
    field: 'email',
    headerName: 'Email',
    width: 250,
    flex: 1,
    renderCell: (params) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonIcon fontSize="small" color="action" />
        {params.value}
      </Box>
    ),
  },
  {
    field: 'first_name',
    headerName: 'First Name',
    width: 150,
    renderCell: (params) => params.value || '-',
  },
  {
    field: 'last_name',
    headerName: 'Last Name',
    width: 150,
    renderCell: (params) => params.value || '-',
  },
  {
    field: 'phone',
    headerName: 'Phone',
    width: 140,
    renderCell: renderPhone,
  },
  {
    field: 'last_sign_in_at',
    headerName: 'Last Sign-In',
    width: 180,
    renderCell: (params) => {
      if (!params.value)
        return (
          <Typography variant="body2" color="text.secondary">
            Never
          </Typography>
        );
      return renderDateTime(params);
    },
  },
  commonColumns.createdAt,
];

export default function ThriveRadioUserTable() {
  const { data: users, isLoading, error } = useThriveRadioUsers();
  const deleteUser = useDeleteThriveRadioUser();

  const handleDelete = (id: string | number) => {
    deleteUser.mutate(String(id));
  };

  const renderForm = ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<ThriveRadioUserEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    return <ThriveRadioUserForm onSuccess={onClose} mode="create" />;
  };

  const usersWithId: ThriveRadioUserEntity[] = (users || []).map((u) => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    phone: u.phone,
    avatar_url: u.avatar_url,
    created_at: u.created_at || new Date().toISOString(),
    updated_at: u.updated_at || new Date().toISOString(),
    last_sign_in_at: u.last_sign_in_at ?? null,
  }));

  return (
    <BaseDataTable<ThriveRadioUserEntity>
      title="Thrive Radio Users"
      data={usersWithId}
      columns={thriveRadioUserColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={(row) => row.id}
      onDelete={handleDelete}
      renderForm={renderForm}
      dialogMaxWidth="sm"
      persistStateKey="thriveRadioUsersGrid"
      createButtonText="Add User"
      deleteButtonText="Remove User"
      deleteConfirmMessage="Are you sure you want to remove this user from Thrive Radio? This action cannot be undone."
      showActionsColumn={true}
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
