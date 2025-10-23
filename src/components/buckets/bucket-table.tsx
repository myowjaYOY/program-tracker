'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import BucketForm from '@/components/forms/bucket-form';
import { useBuckets, useDeleteBucket } from '@/lib/hooks/use-buckets';
import { Buckets } from '@/types/database.types';
import { BucketFormData } from '@/lib/validations/bucket';

// Extend Buckets to satisfy BaseEntity interface
interface BucketEntity extends Omit<Buckets, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// Bucket-specific columns
const bucketColumns: GridColDef[] = [
  {
    field: 'bucket_id',
    headerName: 'ID',
    width: 80,
    type: 'string',
  },
  {
    field: 'bucket_name',
    headerName: 'Name',
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

export default function BucketTable() {
  const { data: buckets, isLoading, error } = useBuckets();
  const deleteBucket = useDeleteBucket();

  const handleDelete = (id: string | number) => {
    deleteBucket.mutate(String(id));
  };

  const handleEdit = (_row: BucketEntity) => {
    // Edit handled by BaseDataTable modal
  };

  const renderBucketForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<BucketEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert BucketEntity to BucketFormData for the form
    const formData: Partial<BucketFormData> & { bucket_id?: string } =
      initialValues
        ? {
            bucket_name: initialValues.bucket_name || '',
            description: initialValues.description || '',
            active_flag: initialValues.active_flag ?? true,
            ...(initialValues.bucket_id && {
              bucket_id: String(initialValues.bucket_id),
            }),
          }
        : {};

    return (
      <BucketForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  // Transform buckets data to include id property and handle null dates
  const bucketsWithId: BucketEntity[] = (buckets || []).map((bucket: any) => ({
    ...bucket,
    id: bucket.bucket_id,
    created_at: bucket.created_at || new Date().toISOString(),
    updated_at: bucket.updated_at || new Date().toISOString(),
    created_by: bucket.created_by_email || '-',
    updated_by: bucket.updated_by_email || '-',
  }));

  return (
    <BaseDataTable<BucketEntity>
      title="Buckets"
      data={bucketsWithId}
      columns={bucketColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.bucket_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderBucketForm}
      persistStateKey="bucketsGrid"
      createButtonText="Add Bucket"
      editButtonText="Edit Bucket"
      deleteButtonText="Delete Bucket"
      deleteConfirmMessage="Are you sure you want to delete this bucket? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
