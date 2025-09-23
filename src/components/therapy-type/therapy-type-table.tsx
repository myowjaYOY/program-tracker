'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Box } from '@mui/material';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import TherapyTypeForm from '@/components/forms/therapy-type-form';
import {
  useTherapyTypes,
  useDeleteTherapyType,
} from '@/lib/hooks/use-therapy-type';
import { TherapyType } from '@/types/database.types';
import { TherapyTypeFormData } from '@/lib/validations/therapy-type';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

interface TherapyTypeEntity
  extends Omit<TherapyType, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

const therapyTypeColumns: GridColDef[] = [
  {
    field: 'therapy_type_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'therapy_type_name',
    headerName: 'Therapy Type Name',
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

export default function TherapyTypeTable() {
  const { data: therapyTypes, isLoading, error } = useTherapyTypes();
  const deleteTherapyType = useDeleteTherapyType();

  const handleDelete = (id: string | number) => {
    deleteTherapyType.mutate(String(id));
  };

  const handleEdit = (_row: TherapyTypeEntity) => {
    // Edit handled by BaseDataTable modal
  };

  const renderTherapyTypeForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<TherapyTypeEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formData: Partial<TherapyTypeFormData> & {
      therapy_type_id?: number;
    } = initialValues
      ? {
          therapy_type_name: initialValues.therapy_type_name || '',
          description: initialValues.description || '',
          active_flag: initialValues.active_flag ?? true,
          ...(initialValues.therapy_type_id && {
            therapy_type_id: initialValues.therapy_type_id,
          }),
        }
      : {};
    return (
      <TherapyTypeForm
        initialValues={formData}
        onSuccess={onClose}
        mode={mode}
      />
    );
  };

  const therapyTypesWithId: TherapyTypeEntity[] = (therapyTypes || []).map(
    therapyType => ({
      ...therapyType,
      id: therapyType.therapy_type_id,
      created_at: therapyType.created_at || new Date().toISOString(),
      updated_at: therapyType.updated_at || new Date().toISOString(),
      created_by:
        (therapyType as { created_by_email?: string }).created_by_email || '-',
      updated_by:
        (therapyType as { updated_by_email?: string }).updated_by_email || '-',
    })
  );

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <BaseDataTable<TherapyTypeEntity>
        title="Therapy Types"
        data={therapyTypesWithId}
        columns={therapyTypeColumns}
        loading={isLoading}
        error={error?.message || null}
        getRowId={row => row.therapy_type_id}
        onEdit={handleEdit}
        onDelete={handleDelete}
        renderForm={renderTherapyTypeForm}
        createButtonText="Add Therapy Type"
        editButtonText="Edit Therapy Type"
        deleteButtonText="Delete Therapy Type"
        deleteConfirmMessage="Are you sure you want to delete this therapy type? This action cannot be undone."
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
      />
      <LoadingOverlay
        loading={isLoading}
        message="Loading therapy types..."
        size="large"
      />
    </Box>
  );
}
