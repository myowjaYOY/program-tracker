'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import TherapyForm from '@/components/forms/therapy-form';
import TherapyRelationshipsPanel from './therapy-relationships-panel';
import { useTherapies, useDeleteTherapy } from '@/lib/hooks/use-therapies';
import { Therapies } from '@/types/database.types';
import { TherapyFormData } from '@/lib/validations/therapy';

interface TherapyEntity extends Omit<Therapies, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

const therapyColumns: GridColDef[] = [
  {
    field: 'therapy_name',
    headerName: 'Therapy Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 250,
    flex: 1,
  },
  {
    field: 'therapy_type_name',
    headerName: 'Therapy Type',
    width: 150,
    flex: 1,
  },
  {
    field: 'bucket_name',
    headerName: 'Bucket',
    width: 150,
    flex: 1,
  },
  {
    field: 'role_name',
    headerName: 'Responsible',
    width: 150,
    flex: 1,
    renderCell: (params: any) => {
      const roleName = params.value || 'Admin';
      const roleColor = params.row.role_display_color || '#808080';
      return (
        <Chip
          label={roleName}
          size="small"
          sx={{
            backgroundColor: roleColor,
            color: '#fff',
            fontWeight: 500,
          }}
        />
      );
    },
  },
  {
    field: 'cost',
    headerName: 'Cost',
    width: 120,
    renderCell: (params: any) => {
      const value = params.value;
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
    field: 'charge',
    headerName: 'Charge',
    width: 120,
    renderCell: (params: any) => {
      const value = params.value;
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
    field: 'taxable',
    headerName: 'Taxable',
    width: 100,
    type: 'boolean',
    renderCell: (params: any) => (
      <Chip 
        label={params.value ? 'Yes' : 'No'} 
        color={params.value ? 'success' : 'default'} 
        size="small" 
      />
    ),
  },
  commonColumns.activeFlag,
  commonColumns.updatedBy,
  commonColumns.updatedAt,
];

export default function TherapyTable() {
  const { data: therapies, isLoading, error } = useTherapies();
  const deleteTherapy = useDeleteTherapy();

  const handleDelete = (id: string | number) => {
    deleteTherapy.mutate(String(id));
  };

  const handleEdit = (_row: TherapyEntity) => {
    // Edit handled by BaseDataTable modal
  };

  const renderTherapyForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<TherapyEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formData: Partial<TherapyFormData> & { therapy_id?: number } =
      initialValues
        ? {
            therapy_name: initialValues.therapy_name || '',
            description: initialValues.description || '',
            therapy_type_id: initialValues.therapy_type_id || 0,
            bucket_id: initialValues.bucket_id || 0,
            program_role_id: initialValues.program_role_id || 2,
            cost: initialValues.cost || 0,
            charge: initialValues.charge || 0,
            active_flag: initialValues.active_flag ?? true,
            taxable: initialValues.taxable ?? false,
            ...(initialValues.therapy_id && {
              therapy_id: initialValues.therapy_id,
            }),
          }
        : {
            therapy_name: '',
            description: '',
            therapy_type_id: 0,
            bucket_id: 0,
            program_role_id: 2,
            cost: 0,
            charge: 0,
            active_flag: true,
            taxable: false,
          };
    return (
      <TherapyForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  const therapiesWithId: TherapyEntity[] = (therapies || []).map(
    (therapy: any) => ({
      ...therapy,
      id: therapy.therapy_id,
      updated_at: therapy.updated_at || new Date().toISOString(),
      updated_by: therapy.updated_by_full_name || therapy.updated_by_email || '-',
    })
  );

  const renderDetailPanel = (row: TherapyEntity) => (
    <TherapyRelationshipsPanel therapyId={String(row.therapy_id)} />
  );

  return (
    <BaseDataTable<TherapyEntity>
      title="Therapies"
      data={therapiesWithId}
      columns={therapyColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.therapy_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderTherapyForm}
      renderDetailPanel={renderDetailPanel}
      persistStateKey="therapiesGrid"
      getDetailPanelHeight={() => 250}
      createButtonText="Add Therapy"
      editButtonText="Edit Therapy"
      deleteButtonText="Delete Therapy"
      deleteConfirmMessage="Are you sure you want to delete this therapy? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      sortModel={[{ field: 'therapy_name', sort: 'asc' }]}
    />
  );
}
