'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Box } from '@mui/material';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import StatusForm from '@/components/forms/status-form';
import { useStatus, useDeleteStatus } from '@/lib/hooks/use-status';
import { Status } from '@/types/database.types';
import { StatusFormData } from '@/lib/validations/status';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

interface StatusEntity extends Omit<Status, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

const statusColumns: GridColDef[] = [
  {
    field: 'status_id',
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

export default function StatusTable() {
  const { data: statuses, isLoading, error } = useStatus();
  const deleteStatus = useDeleteStatus();

  const handleDelete = (id: string | number) => {
    deleteStatus.mutate(String(id));
  };

  const handleEdit = (_row: StatusEntity) => {
    // Edit handled by BaseDataTable modal
  };

  const renderStatusForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<StatusEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formData: Partial<StatusFormData> & { status_id?: number } =
      initialValues
        ? {
            status_name: initialValues.status_name || '',
            description: initialValues.description || '',
            active_flag: initialValues.active_flag ?? true,
            ...(initialValues.status_id && {
              status_id: initialValues.status_id,
            }),
          }
        : {};
    return (
      <StatusForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  const statusesWithId: StatusEntity[] = (statuses || []).map(status => ({
    ...status,
    id: status.status_id,
    created_at: status.created_at || new Date().toISOString(),
    updated_at: status.updated_at || new Date().toISOString(),
    created_by: (status as any).created_by_email || '-',
    updated_by: (status as any).updated_by_email || '-',
  }));

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <BaseDataTable<StatusEntity>
        title="Lead Status"
        data={statusesWithId}
        columns={statusColumns}
        loading={isLoading}
        error={error?.message || null}
        getRowId={row => row.status_id}
        onEdit={handleEdit}
        onDelete={handleDelete}
        renderForm={renderStatusForm}
        persistStateKey="leadStatusGrid"
        createButtonText="Add Lead Status"
        editButtonText="Edit Lead Status"
        deleteButtonText="Delete Lead Status"
        deleteConfirmMessage="Are you sure you want to delete this lead status? This action cannot be undone."
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
      />
      <LoadingOverlay
        loading={isLoading}
        message="Loading lead statuses..."
        size="large"
      />
    </Box>
  );
}
