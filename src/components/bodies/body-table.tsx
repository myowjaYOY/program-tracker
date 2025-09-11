'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import BodyForm from '@/components/forms/body-form';
import { useBodies, useDeleteBody } from '@/lib/hooks/use-bodies';
import { Bodies } from '@/types/database.types';
import { BodyFormData } from '@/lib/validations/body';

interface BodyEntity extends Omit<Bodies, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

const bodyColumns: GridColDef[] = [
  {
    field: 'body_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'body_name',
    headerName: 'Body Name',
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

export default function BodyTable() {
  const { data: bodies, isLoading, error } = useBodies();
  const deleteBody = useDeleteBody();

  const handleDelete = (id: string | number) => {
    deleteBody.mutate(String(id));
  };

  const handleEdit = (_row: BodyEntity) => {
    // Edit handled by BaseDataTable modal
  };

  const renderBodyForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<BodyEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formData: Partial<BodyFormData> & { body_id?: number } = initialValues
      ? {
          body_name: initialValues.body_name || '',
          description: initialValues.description || '',
          active_flag: initialValues.active_flag ?? true,
          ...(initialValues.body_id && { body_id: initialValues.body_id }),
        }
      : {};
    return (
      <BodyForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  const bodiesWithId: BodyEntity[] = (bodies || []).map(body => ({
    ...body,
    id: body.body_id,
    created_at: body.created_at || new Date().toISOString(),
    updated_at: body.updated_at || new Date().toISOString(),
    created_by: body.created_by_email || '-',
    updated_by: body.updated_by_email || '-',
  }));

  return (
    <BaseDataTable<BodyEntity>
      title="Bodies"
      data={bodiesWithId}
      columns={bodyColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.body_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderBodyForm}
      createButtonText="Add Body"
      editButtonText="Edit Body"
      deleteButtonText="Delete Body"
      deleteConfirmMessage="Are you sure you want to delete this body? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
