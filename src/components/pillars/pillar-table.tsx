'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import PillarForm from '@/components/forms/pillar-form';
import { usePillars, useDeletePillar } from '@/lib/hooks/use-pillars';
import { Pillars } from '@/types/database.types';
import { PillarFormData } from '@/lib/validations/pillar';

interface PillarEntity extends Omit<Pillars, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

const pillarColumns: GridColDef[] = [
  {
    field: 'pillar_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'pillar_name',
    headerName: 'Pillar Name',
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

export default function PillarTable() {
  const { data: pillars, isLoading, error } = usePillars();
  const deletePillar = useDeletePillar();

  const handleDelete = (id: string | number) => {
    deletePillar.mutate(String(id));
  };

  const handleEdit = (_row: PillarEntity) => {
    // Edit handled by BaseDataTable modal
  };

  const renderPillarForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<PillarEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formData: Partial<PillarFormData> & { pillar_id?: number } =
      initialValues
        ? {
            pillar_name: initialValues.pillar_name || '',
            description: initialValues.description || '',
            active_flag: initialValues.active_flag ?? true,
            ...(initialValues.pillar_id && {
              pillar_id: initialValues.pillar_id,
            }),
          }
        : {};
    return (
      <PillarForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  const pillarsWithId: PillarEntity[] = (pillars || []).map(pillar => ({
    ...pillar,
    id: pillar.pillar_id,
    created_at: pillar.created_at || new Date().toISOString(),
    updated_at: pillar.updated_at || new Date().toISOString(),
    created_by: (pillar as any).created_by_email || '-',
    updated_by: (pillar as any).updated_by_email || '-',
  }));

  return (
    <BaseDataTable<PillarEntity>
      title="Pillars"
      data={pillarsWithId}
      columns={pillarColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.pillar_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderPillarForm}
      createButtonText="Add Pillar"
      editButtonText="Edit Pillar"
      deleteButtonText="Delete Pillar"
      deleteConfirmMessage="Are you sure you want to delete this pillar? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
