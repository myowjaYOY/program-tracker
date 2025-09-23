'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
} from '@/components/tables/base-data-table';
import ProgramTemplateForm from './program-template-form';
import {
  useProgramTemplates,
  useDeleteProgramTemplate,
} from '@/lib/hooks/use-program-templates';
import { ProgramTemplate } from '@/types/database.types';
import { ProgramTemplateFormData } from '@/lib/validations/program-template';

// Extend ProgramTemplate to satisfy BaseEntity interface
interface ProgramTemplateEntity
  extends Omit<ProgramTemplate, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
}

// Program Template-specific columns
const programTemplateColumns: GridColDef[] = [
  {
    field: 'program_template_name',
    headerName: 'Template Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 300,
  },
  {
    field: 'total_cost',
    headerName: 'Total Cost',
    width: 120,
    type: 'number',
    renderCell: (params: any) => {
      const value = params.row.total_cost;
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
    field: 'total_charge',
    headerName: 'Total Charge',
    width: 120,
    type: 'number',
    renderCell: (params: any) => {
      const value = params.row.total_charge;
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
    field: 'margin_percentage',
    headerName: 'Margin %',
    width: 100,
    type: 'number',
    renderCell: (params: any) => {
      const value = params.row.margin_percentage;
      if (value == null || value === 0) return '0.0%';
      return `${Number(value).toFixed(1)}%`;
    },
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

interface ProgramTemplatesGridProps {
  onTemplateSelect: (template: ProgramTemplate | null) => void;
  selectedTemplate: ProgramTemplate | null;
}

export default function ProgramTemplatesGrid({
  onTemplateSelect,
  selectedTemplate,
}: ProgramTemplatesGridProps) {
  const { data: templates, isLoading, error } = useProgramTemplates();
  const deleteTemplate = useDeleteProgramTemplate();

  // Debug logging
  console.log('ProgramTemplatesGrid render:', {
    templates,
    isLoading,
    error,
  });

  const handleDelete = (id: string | number) => {
    deleteTemplate.mutate(Number(id));
  };

  const handleEdit = (_row: ProgramTemplateEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const renderProgramTemplateForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<ProgramTemplateEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // For create mode, don't pass any initialValues
    // For edit mode, pass the initialValues with program_template_id
    const formData: Partial<ProgramTemplateFormData> & {
      program_template_id?: number;
    } =
      mode === 'edit' && initialValues
        ? {
            program_template_name: initialValues.program_template_name || '',
            description: initialValues.description || '',
            active_flag: initialValues.active_flag ?? true,
            ...(initialValues.program_template_id && {
              program_template_id: initialValues.program_template_id,
            }),
          }
        : {};

    return (
      <ProgramTemplateForm
        initialValues={formData}
        onSuccess={onClose}
        mode={mode}
      />
    );
  };

  // Transform templates data to include id property and handle null dates
  const templatesWithId: ProgramTemplateEntity[] = (templates || []).map(
    template => ({
      ...template,
      id: template.program_template_id,
      created_at: template.created_at || new Date().toISOString(),
      updated_at: template.updated_at || new Date().toISOString(),
      created_by: template.created_by_email || '-',
      updated_by: template.updated_by_email || '-',
    })
  );

  // Debug: Check the first template's calculated fields
  if (templatesWithId.length > 0) {
    const firstTemplate = templatesWithId[0];
    console.log('First template in templatesWithId:', {
      id: firstTemplate?.id,
      name: firstTemplate?.program_template_name,
      total_cost: firstTemplate?.total_cost,
      total_charge: firstTemplate?.total_charge,
      margin_percentage: firstTemplate?.margin_percentage,
    });
  }

  const handleRowClick = (row: ProgramTemplateEntity) => {
    // Convert ProgramTemplateEntity back to ProgramTemplate for selection
    const template: ProgramTemplate = {
      program_template_id: row.program_template_id,
      program_template_name: row.program_template_name,
      description: row.description,
      total_cost: row.total_cost,
      total_charge: row.total_charge,
      margin_percentage: row.margin_percentage,
      active_flag: row.active_flag,
      created_at: row.created_at,
      created_by: row.created_by,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
      created_by_email: row.created_by_email || null,
      created_by_full_name: row.created_by_full_name || null,
      updated_by_email: row.updated_by_email || null,
      updated_by_full_name: row.updated_by_full_name || null,
    };
    onTemplateSelect(template);
  };

  return (
    <BaseDataTable<ProgramTemplateEntity>
      title="Program Templates"
      data={templatesWithId}
      columns={programTemplateColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.program_template_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onRowClick={handleRowClick}
      renderForm={renderProgramTemplateForm}
      createButtonText="Add Program Template"
      editButtonText="Edit Template"
      deleteButtonText="Delete Template"
      deleteConfirmMessage="Are you sure you want to delete this template? This action cannot be undone."
      pageSize={5}
      pageSizeOptions={[5, 10, 25, 50]}
      autoHeight={true}
      selectedRowId={selectedTemplate?.program_template_id || null}
      showActionsColumn={false}
    />
  );
}
