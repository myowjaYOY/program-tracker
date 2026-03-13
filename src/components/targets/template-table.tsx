'use client';

import React, { useMemo } from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable from '@/components/tables/base-data-table';
import { Typography } from '@mui/material';
import TemplateForm from '@/components/forms/template-form';
import {
  useMetricDefinitions,
  getMetricDefinition,
  type MetricDefinition,
  type PeriodType,
} from '@/lib/hooks/use-metric-definitions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function formatTemplateValue(
  metrics: MetricDefinition[] | undefined,
  metricKey: string,
  value: number
): string {
  const def = metrics ? getMetricDefinition(metrics, metricKey) : undefined;
  if (!def) return String(value);
  if (def.value_type === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (def.value_type === 'percent') {
    return `${value}%`;
  }
  return String(Number.isInteger(value) ? value : value.toFixed(2));
}

const SECTION_LABELS: Record<string, string> = {
  FINANCIAL_HEALTH: 'Financial Health',
  MARKETING_ENGINE: 'Marketing Engine',
  SALES_PERFORMANCE: 'Sales Performance',
  CLIENT_MODEL_STRENGTH: 'Client Model Strength',
};

interface TemplateRow {
  id: number;
  template_name: string;
  period_type: PeriodType;
  metric_key: string;
  metric_label: string;
  section: string;
  target_value: number;
  notes: string | null;
}

export const TEMPLATES_QUERY_KEY = 'operations-target-templates';

export default function TemplateTable() {
  const queryClient = useQueryClient();
  const { data: metrics = [] } = useMetricDefinitions();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: [TEMPLATES_QUERY_KEY],
    queryFn: async () => {
      const res = await fetch('/api/operations/target-templates');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const json = await res.json();
      return (json.data || []) as Array<{
        id: number;
        template_name: string;
        metric_key: string;
        period_type: PeriodType;
        target_value: number;
        notes: string | null;
      }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/operations/target-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] });
    },
  });

  const rows: TemplateRow[] = templates.map((t) => {
    const def = metrics.find((m) => m.metric_key === t.metric_key);
    return {
    id: t.id,
    template_name: t.template_name,
    period_type: t.period_type,
    metric_key: t.metric_key,
    metric_label: def?.label ?? t.metric_key,
    section: def?.dashboard_section ? (SECTION_LABELS[def.dashboard_section] ?? def.dashboard_section) : '—',
    target_value: t.target_value,
    notes: t.notes,
  };
  });

  const usedKeys = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const t of templates) {
      if (!map.has(t.period_type)) map.set(t.period_type, new Set());
      map.get(t.period_type)!.add(t.metric_key);
    }
    return map;
  }, [templates]);

  const columns: GridColDef[] = [
    {
      field: 'period_type',
      headerName: 'Type',
      width: 100,
      flex: 0,
      type: 'singleSelect',
      valueOptions: [
        { value: 'WEEK', label: 'Weekly' },
        { value: 'MONTH', label: 'Monthly' },
      ],
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value === 'WEEK' ? 'Weekly' : 'Monthly'}
        </Typography>
      ),
      sortable: true,
      filterable: true,
    },
    {
      field: 'section',
      headerName: 'Section',
      width: 180,
      flex: 0,
    },
    {
      field: 'metric_label',
      headerName: 'Metric',
      width: 220,
      flex: 1,
    },
    {
      field: 'target_value',
      headerName: 'Target Value',
      width: 140,
      flex: 0,
      renderCell: (params) => (
        <Typography variant="body2">
          {formatTemplateValue(metrics, params.row.metric_key, params.row.target_value)}
        </Typography>
      ),
    },
    {
      field: 'notes',
      headerName: 'Notes',
      width: 200,
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {(params.value as string) || '—'}
        </Typography>
      ),
    },
  ];

  const renderTemplateForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<TemplateRow>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formInitialValues =
      initialValues &&
      initialValues.period_type &&
      initialValues.metric_key != null
        ? {
            ...(initialValues.id != null && { id: initialValues.id }),
            period_type: initialValues.period_type,
            metric_key: initialValues.metric_key,
            target_value: initialValues.target_value ?? 0,
            notes: initialValues.notes ?? null,
          }
        : undefined;

    return (
      <TemplateForm
        {...(formInitialValues && { initialValues: formInitialValues })}
        onSuccess={onClose}
        mode={mode}
        {...(mode === 'create' && { usedKeys })}
      />
    );
  };

  return (
    <BaseDataTable<TemplateRow>
      title=""
      data={rows}
      columns={columns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={(row) => row.id}
      onEdit={() => {}}
      onDelete={(id) => deleteMutation.mutate(Number(id))}
      renderForm={renderTemplateForm}
      createButtonText="Add Template Item"
      formTitle="Add Template Item"
      editButtonText="Edit template"
      deleteButtonText="Delete template"
      deleteConfirmMessage="Are you sure you want to delete this template entry?"
      pageSize={25}
      pageSizeOptions={[10, 25, 50]}
      autoHeight
    />
  );
}
