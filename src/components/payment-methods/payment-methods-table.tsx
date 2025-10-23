'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import { PaymentMethods } from '@/types/database.types';
import { PaymentMethodsFormData } from '@/lib/validations/payment-methods';
import {
  usePaymentMethods,
  useDeletePaymentMethods,
} from '@/lib/hooks/use-payment-methods';
import PaymentMethodsForm from '@/components/forms/payment-methods-form';

// Extended interface for table display
interface PaymentMethodsEntity
  extends Omit<PaymentMethods, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// Payment Methods-specific columns
const paymentMethodsColumns: GridColDef[] = [
  {
    field: 'payment_method_name',
    headerName: 'Method Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'payment_method_description',
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

export default function PaymentMethodsTable() {
  const { data: paymentMethods, isLoading, error } = usePaymentMethods();
  const deletePaymentMethods = useDeletePaymentMethods();

  const handleDelete = (id: string | number) => {
    deletePaymentMethods.mutate(String(id));
  };

  const handleEdit = (_row: PaymentMethodsEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const renderPaymentMethodsForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<PaymentMethodsEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert PaymentMethodsEntity to PaymentMethodsFormData for the form
    const formData: Partial<PaymentMethodsFormData> & {
      payment_method_id?: number;
    } = initialValues
      ? {
          payment_method_name: initialValues.payment_method_name || '',
          payment_method_description:
            initialValues.payment_method_description || '',
          active_flag: initialValues.active_flag ?? true,
          ...(initialValues.payment_method_id && {
            payment_method_id: initialValues.payment_method_id,
          }),
        }
      : {};

    return (
      <PaymentMethodsForm
        initialValues={formData}
        onSuccess={onClose}
        mode={mode}
      />
    );
  };

  // Transform payment methods data to include id property and handle null dates
  const paymentMethodsWithId: PaymentMethodsEntity[] = (
    paymentMethods || []
  ).map(method => ({
    ...method,
    id: method.payment_method_id,
    created_at: method.created_at || new Date().toISOString(),
    updated_at: method.updated_at || new Date().toISOString(),
    created_by: method.created_by_email || '-',
    updated_by: method.updated_by_email || '-',
  }));

  return (
    <BaseDataTable<PaymentMethodsEntity>
      title="Payment Methods"
      data={paymentMethodsWithId}
      columns={paymentMethodsColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.payment_method_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderPaymentMethodsForm}
      persistStateKey="paymentMethodsGrid"
      createButtonText="Add Payment Method"
      editButtonText="Edit Payment Method"
      deleteButtonText="Delete Payment Method"
      deleteConfirmMessage="Are you sure you want to delete this payment method? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
