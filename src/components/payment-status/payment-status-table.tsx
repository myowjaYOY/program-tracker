'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import { PaymentStatus } from '@/types/database.types';
import { PaymentStatusFormData } from '@/lib/validations/payment-status';
import {
  usePaymentStatus,
  useDeletePaymentStatus,
} from '@/lib/hooks/use-payment-status';
import PaymentStatusForm from '@/components/forms/payment-status-form';

// Extended interface for table display
interface PaymentStatusEntity
  extends Omit<PaymentStatus, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// Payment Status-specific columns
const paymentStatusColumns: GridColDef[] = [
  {
    field: 'payment_status_name',
    headerName: 'Status Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'payment_status_description',
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

export default function PaymentStatusTable() {
  const { data: paymentStatus, isLoading, error } = usePaymentStatus();
  const deletePaymentStatus = useDeletePaymentStatus();

  const handleDelete = (id: string | number) => {
    deletePaymentStatus.mutate(String(id));
  };

  const handleEdit = (_row: PaymentStatusEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const renderPaymentStatusForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<PaymentStatusEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert PaymentStatusEntity to PaymentStatusFormData for the form
    const formData: Partial<PaymentStatusFormData> & {
      payment_status_id?: number;
    } = initialValues
      ? {
          payment_status_name: initialValues.payment_status_name || '',
          payment_status_description:
            initialValues.payment_status_description || '',
          active_flag: initialValues.active_flag ?? true,
          ...(initialValues.payment_status_id && {
            payment_status_id: initialValues.payment_status_id,
          }),
        }
      : {};

    return (
      <PaymentStatusForm
        initialValues={formData}
        onSuccess={onClose}
        mode={mode}
      />
    );
  };

  // Transform payment status data to include id property and handle null dates
  const paymentStatusWithId: PaymentStatusEntity[] = (paymentStatus || []).map(
    status => ({
      ...status,
      id: status.payment_status_id,
      created_at: status.created_at || new Date().toISOString(),
      updated_at: status.updated_at || new Date().toISOString(),
      created_by: status.created_by_email || '-',
      updated_by: status.updated_by_email || '-',
    })
  );

  return (
    <BaseDataTable<PaymentStatusEntity>
      title="Payment Status"
      data={paymentStatusWithId}
      columns={paymentStatusColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.payment_status_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderPaymentStatusForm}
      persistStateKey="paymentStatusGrid"
      createButtonText="Add Payment Status"
      editButtonText="Edit Payment Status"
      deleteButtonText="Delete Payment Status"
      deleteConfirmMessage="Are you sure you want to delete this payment status? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
