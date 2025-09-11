'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
  renderPhone,
} from '@/components/tables/base-data-table';
import VendorForm from '@/components/forms/vendor-form';
import { useVendors, useDeleteVendor } from '@/lib/hooks/use-vendors';
import { Vendors } from '@/types/database.types';
import { VendorFormData } from '@/lib/validations/vendor';

// Extend Vendors to satisfy BaseEntity interface
interface VendorEntity extends Omit<Vendors, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// Vendor-specific columns
const vendorColumns: GridColDef[] = [
  {
    field: 'vendor_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'vendor_name',
    headerName: 'Vendor Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'contact_person',
    headerName: 'Contact Person',
    width: 150,
  },
  {
    field: 'phone',
    headerName: 'Phone',
    width: 130,
    renderCell: renderPhone,
  },
  {
    field: 'email',
    headerName: 'Email',
    width: 200,
  },
  commonColumns.activeFlag,
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

export default function VendorTable() {
  const { data: vendors, isLoading, error } = useVendors();
  const deleteVendor = useDeleteVendor();

  const handleDelete = (id: string | number) => {
    deleteVendor.mutate(String(id));
  };

  const handleEdit = (_row: VendorEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
    // console.log('Edit vendor:', row);
  };

  const renderVendorForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<VendorEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert VendorEntity to VendorFormData for the form
    const formData: Partial<VendorFormData> & { vendor_id?: number } =
      initialValues
        ? {
            vendor_name: initialValues.vendor_name || '',
            contact_person: initialValues.contact_person || '',
            phone: initialValues.phone || '',
            email: initialValues.email || undefined,
            active_flag: initialValues.active_flag,
            ...(initialValues.vendor_id && {
              vendor_id: initialValues.vendor_id,
            }),
          }
        : {};

    return (
      <VendorForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  // Transform vendors data to include id property and handle null dates
  const vendorsWithId: VendorEntity[] = (vendors || []).map(vendor => ({
    ...vendor,
    id: vendor.vendor_id,
    created_at: vendor.created_at || new Date().toISOString(),
    updated_at: vendor.updated_at || new Date().toISOString(),
    created_by: vendor.created_by_email || '-',
    updated_by: vendor.updated_by_email || '-',
  }));

  return (
    <BaseDataTable<VendorEntity>
      title="Vendors"
      data={vendorsWithId}
      columns={vendorColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.vendor_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderVendorForm}
      createButtonText="Add Vendor"
      editButtonText="Edit Vendor"
      deleteButtonText="Delete Vendor"
      deleteConfirmMessage="Are you sure you want to delete this vendor? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
