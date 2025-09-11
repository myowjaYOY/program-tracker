'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Box, Chip, Button, Typography, CircularProgress } from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import UserForm from '@/components/forms/user-form';
import { useUsers, useDeleteUser } from '@/lib/hooks/use-admin';
import { User } from '@/lib/hooks/use-admin';
import { UserFormData } from '@/lib/validations/user';

// Extend User to satisfy BaseEntity interface
interface UserEntity extends User {
  id: string;
}

// Props for sync menu items functionality
interface SyncMenuItemsProps {
  onSync: () => void;
  isPending: boolean;
}

// Props for clear menu items functionality
interface ClearMenuItemsProps {
  onClear: () => void;
  isPending: boolean;
}

// UserTable props
interface UserTableProps {
  syncMenuItemsProps?: SyncMenuItemsProps;
  clearMenuItemsProps?: ClearMenuItemsProps;
}

// User-specific columns
const userColumns: GridColDef[] = [
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
    field: 'full_name',
    headerName: 'Full Name',
    width: 200,
    renderCell: (params) => params.value || '-',
  },
  {
    field: 'is_admin',
    headerName: 'Admin',
    width: 100,
    renderCell: (params) => (
      <Chip
        label={params.value ? 'Admin' : 'User'}
        color={params.value ? 'primary' : 'default'}
        size="small"
        {...(params.value && { icon: <AdminIcon /> })}
      />
    ),
  },
  {
    field: 'is_active',
    headerName: 'Status',
    width: 100,
    renderCell: (params) => (
      <Chip
        label={params.value ? 'Active' : 'Inactive'}
        color={params.value ? 'success' : 'default'}
        size="small"
      />
    ),
  },
  commonColumns.createdAt,
];

export default function UserTable({ syncMenuItemsProps, clearMenuItemsProps }: UserTableProps = {}) {
  const { data: users, isLoading, error } = useUsers();
  const deleteUser = useDeleteUser();

  const handleDelete = (id: string | number) => {
    deleteUser.mutate(String(id));
  };

  const handleEdit = (_row: UserEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const renderUserForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<UserEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert UserEntity to UserFormData for the form
    const formData: Partial<UserFormData> & { id?: string } = initialValues
      ? {
          email: initialValues.email || '',
          full_name: initialValues.full_name || '',
          is_admin: initialValues.is_admin ?? false,
          is_active: initialValues.is_active ?? false,
          ...(initialValues.id && {
            id: initialValues.id,
          }),
        }
      : {};

    return (
      <UserForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  // Transform users data to include proper id property
  const usersWithId: UserEntity[] = (users || []).map(user => ({
    ...user,
    id: user.id,
  }));

  // Create sync button component
  const syncButton = syncMenuItemsProps ? (
    <Button
      variant="outlined"
      startIcon={<RefreshIcon />}
      onClick={syncMenuItemsProps.onSync}
      disabled={syncMenuItemsProps.isPending}
      sx={{
        borderRadius: 0, // Square corners
        fontWeight: 600,
        mr: 1,
      }}
    >
      {syncMenuItemsProps.isPending ? (
        <CircularProgress size={20} />
      ) : (
        'Sync Menu Items'
      )}
    </Button>
  ) : null;

  // Create clear button component
  const clearButton = clearMenuItemsProps ? (
    <Button
      variant="outlined"
      color="error"
      onClick={clearMenuItemsProps.onClear}
      disabled={clearMenuItemsProps.isPending}
      sx={{
        borderRadius: 0, // Square corners
        fontWeight: 600,
      }}
    >
      {clearMenuItemsProps.isPending ? (
        <CircularProgress size={20} />
      ) : (
        'Clear Menu Items'
      )}
    </Button>
  ) : null;

  return (
    <BaseDataTable<UserEntity>
      title="User Management"
      data={usersWithId}
      columns={userColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderUserForm}
      createButtonText="Add User"
      editButtonText="Edit User"
      deleteButtonText="Delete User"
      deleteConfirmMessage="Are you sure you want to delete this user? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      additionalHeaderButtons={
        <Box sx={{ display: 'flex', gap: 1 }}>
          {syncButton}
          {clearButton}
        </Box>
      }
    />
  );
}
