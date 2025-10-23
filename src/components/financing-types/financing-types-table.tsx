'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import { FinancingTypes } from '@/types/database.types';
import { FinancingTypesFormData } from '@/lib/validations/financing-types';
import {
  useFinancingTypes,
  useDeleteFinancingTypes,
} from '@/lib/hooks/use-financing-types';
import FinancingTypesForm from '@/components/forms/financing-types-form';

// Extended interface for table display
interface FinancingTypesEntity
  extends Omit<FinancingTypes, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// Financing Types-specific columns
const financingTypesColumns: GridColDef[] = [
  {
    field: 'financing_type_name',
    headerName: 'Type Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'financing_source',
    headerName: 'Source',
    width: 140,
  },
  {
    field: 'financing_type_description',
    headerName: 'Description',
    width: 300,
  },
  {
    ...commonColumns.activeFlag,
    headerName: 'Flag',
  },
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

export default function FinancingTypesTable() {
  const { data: financingTypes, isLoading, error } = useFinancingTypes();
  const deleteFinancingTypes = useDeleteFinancingTypes();

  const handleDelete = (id: string | number) => {
    deleteFinancingTypes.mutate(String(id));
  };

  const handleEdit = (_row: FinancingTypesEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const renderFinancingTypesForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<FinancingTypesEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert FinancingTypesEntity to FinancingTypesFormData for the form
    const formData: Partial<FinancingTypesFormData> & {
      financing_type_id?: number;
    } = initialValues
      ? {
          financing_type_name: initialValues.financing_type_name || '',
          financing_type_description:
            initialValues.financing_type_description || '',
          active_flag: initialValues.active_flag ?? true,
          financing_source: 'internal' as const,
          ...(initialValues.financing_type_id && {
            financing_type_id: initialValues.financing_type_id,
          }),
        }
      : {};

    return (
      <FinancingTypesForm
        initialValues={formData}
        onSuccess={onClose}
        mode={mode}
      />
    );
  };

  // Transform financing types data to include id property and handle null dates
  const financingTypesWithId: FinancingTypesEntity[] = (
    financingTypes || []
  ).map(type => ({
    ...type,
    id: type.financing_type_id,
    created_at: type.created_at || new Date().toISOString(),
    updated_at: type.updated_at || new Date().toISOString(),
    created_by: type.created_by_email || '-',
    updated_by: type.updated_by_email || '-',
  }));

  return (
    <BaseDataTable<FinancingTypesEntity>
      title="Financing Types"
      data={financingTypesWithId}
      columns={financingTypesColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.financing_type_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderFinancingTypesForm}
      persistStateKey="financingTypesGrid"
      createButtonText="Add Financing Type"
      editButtonText="Edit Financing Type"
      deleteButtonText="Delete Financing Type"
      deleteConfirmMessage="Are you sure you want to delete this financing type? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
