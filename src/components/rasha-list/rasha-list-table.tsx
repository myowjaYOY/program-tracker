'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import RashaListForm from '@/components/forms/rasha-list-form';
import { useRashaLists, useDeleteRashaList } from '@/lib/hooks/use-rasha-list';
import { RashaList } from '@/types/database.types';
import { RashaListFormData } from '@/lib/validations/rasha-list';

// Extend RashaList to satisfy BaseEntity interface
interface RashaListEntity extends Omit<RashaList, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// RASHA List-specific columns
const rashaListColumns: GridColDef[] = [
  {
    field: 'rasha_list_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'name',
    headerName: 'Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'length',
    headerName: 'Length',
    width: 120,
    type: 'number',
  },
  commonColumns.activeFlag,
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

export default function RashaListTable() {
  const { data: rashaLists, isLoading, error } = useRashaLists();
  const deleteRashaList = useDeleteRashaList();

  const handleDelete = (id: string | number) => {
    deleteRashaList.mutate(String(id));
  };

  const handleEdit = (_row: RashaListEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
    // console.log('Edit RASHA item:', row);
  };

  const renderRashaListForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<RashaListEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert RashaListEntity to RashaListFormData for the form
    const formData: Partial<RashaListFormData> & { rasha_list_id?: number } =
      initialValues
        ? {
            name: initialValues.name || '',
            length: initialValues.length || 0,
            active_flag: initialValues.active_flag,
            ...(initialValues.rasha_list_id && {
              rasha_list_id: initialValues.rasha_list_id,
            }),
          }
        : {};

    return (
      <RashaListForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  // Transform rasha_list data to include id property and handle null dates
  const rashaListsWithId: RashaListEntity[] = (rashaLists || []).map(item => ({
    ...item,
    id: item.rasha_list_id,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString(),
    created_by: item.created_by_email || '-',
    updated_by: item.updated_by_email || '-',
  }));

  return (
    <BaseDataTable<RashaListEntity>
      title="RASHA List"
      data={rashaListsWithId}
      columns={rashaListColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.rasha_list_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderRashaListForm}
      createButtonText="Add RASHA Item"
      editButtonText="Edit RASHA Item"
      deleteButtonText="Delete RASHA Item"
      deleteConfirmMessage="Are you sure you want to delete this RASHA item? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}

