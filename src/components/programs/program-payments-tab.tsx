'use client';

import React from 'react';
import { Box } from '@mui/material';
import BaseDataTable, {
  commonColumns,
  renderCurrency,
  renderDate,
} from '@/components/tables/base-data-table';
import { MemberPrograms, MemberProgramPayments } from '@/types/database.types';
import { useMemberProgramPayments } from '@/lib/hooks/use-member-program-payments';
import { useProgramStatus } from '@/lib/hooks/use-program-status';
import MemberProgramPaymentForm from '@/components/forms/member-program-payment-form';

interface ProgramPaymentsTabProps {
  program: MemberPrograms;
}

interface PaymentRow extends MemberProgramPayments {
  id: number;
}

export default function ProgramPaymentsTab({
  program,
}: ProgramPaymentsTabProps) {
  const {
    data = [],
    isLoading,
    error,
  } = useMemberProgramPayments(program.member_program_id);
  const { data: statuses = [] } = useProgramStatus();
  const statusName = (
    statuses.find(s => s.program_status_id === program.program_status_id)
      ?.status_name || ''
  ).toLowerCase();
  const canEdit = statusName === 'quote' || statusName === 'active';

  const rows: PaymentRow[] = (data || []).map(p => ({
    ...p,
    id: p.member_program_payment_id,
  }));

  const columns = [
    {
      field: 'payment_due_date',
      headerName: 'Due Date',
      width: 130,
      renderCell: renderDate,
    },
    {
      field: 'payment_date',
      headerName: 'Paid Date',
      width: 130,
      renderCell: renderDate,
    },
    {
      field: 'payment_amount',
      headerName: 'Amount',
      width: 120,
      type: 'number',
      renderCell: renderCurrency,
      valueFormatter: (value?: number) => {
        if (value == null) return '-';
        return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    { field: 'payment_status_name', headerName: 'Status', width: 140 },
    { field: 'payment_method_name', headerName: 'Method', width: 140 },
    { field: 'payment_reference', headerName: 'Reference', width: 180 },
    { field: 'notes', headerName: 'Notes', width: 240 },
  ];

  return (
    <Box>
      <BaseDataTable<any>
        title="Payments"
        data={rows}
        columns={columns as any}
        loading={isLoading}
        error={error?.message || null}
        getRowId={row => row.member_program_payment_id}
        showCreateButton={false}
        showActionsColumn={canEdit}
        onEdit={canEdit ? () => {} : (undefined as unknown as any)}
        renderForm={({ onClose, initialValues, mode }) => (
          <MemberProgramPaymentForm
            programId={program.member_program_id}
            initialValues={initialValues as any}
            mode={mode}
            onSuccess={onClose}
            programStatus={statusName}
          />
        )}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        autoHeight={true}
        aggregationModel={{ payment_amount: 'sum' }}
        showAggregationFooter={true}
        aggregationLabel="Total of Payments:"
      />
    </Box>
  );
}
