'use client';

import React, { useMemo } from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable from '@/components/tables/base-data-table';
import { Typography } from '@mui/material';
import TargetForm from '@/components/forms/target-form';
import {
  useMetricDefinitions,
  getMetricDefinition,
  type MetricDefinition,
  type PeriodType,
} from '@/lib/hooks/use-metric-definitions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getISOWeek, getISOWeekYear } from 'date-fns';

function formatPeriodDisplay(periodType: PeriodType, periodStart: string): string {
  if (periodType === 'MONTH') {
    const parts = periodStart.split('-').map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const m = parts[1] ?? 1;
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }
  const d = new Date(periodStart + 'T12:00:00');
  const week = getISOWeek(d);
  const year = getISOWeekYear(d);
  return `Week ${week}, ${year}`;
}

function formatTargetValue(
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

interface TargetRow {
  id: number;
  period_type: PeriodType;
  period_start: string;
  period_display: string;
  metric_key: string;
  metric_label: string;
  target_value: number;
  notes: string | null;
}

const TARGETS_QUERY_KEY = 'operations-targets';

export default function TargetsTable() {
  const queryClient = useQueryClient();
  const { data: metrics = [] } = useMetricDefinitions();

  const { data: targets = [], isLoading, error } = useQuery({
    queryKey: [TARGETS_QUERY_KEY],
    queryFn: async () => {
      const res = await fetch('/api/operations/targets');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const json = await res.json();
      return (json.data || []) as Array<{
        id: number;
        metric_key: string;
        period_type: PeriodType;
        period_start: string;
        target_value: number;
        notes: string | null;
      }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/operations/targets', {
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
      queryClient.invalidateQueries({ queryKey: [TARGETS_QUERY_KEY] });
    },
  });

  const normalizeDate = (s: string) => (s && s.length >= 10 ? s.slice(0, 10) : s);

  const rows: TargetRow[] = targets.map((t) => ({
    id: t.id,
    period_type: t.period_type,
    period_start: normalizeDate(t.period_start),
    period_display: formatPeriodDisplay(t.period_type, normalizeDate(t.period_start)),
    metric_key: t.metric_key,
    metric_label: metrics.find((m) => m.metric_key === t.metric_key)?.label ?? t.metric_key,
    target_value: t.target_value,
    notes: t.notes,
  }));

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
      field: 'period_display',
      headerName: 'Period',
      width: 160,
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
          {formatTargetValue(metrics, params.row.metric_key, params.row.target_value)}
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

  const usedKeysForPeriod = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const t of targets) {
      const key = `${t.period_type}|${t.period_start}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(t.metric_key);
    }
    return map;
  }, [targets]);

  const renderTargetForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<TargetRow>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formInitialValues =
      initialValues &&
      initialValues.period_type &&
      initialValues.period_start &&
      initialValues.metric_key != null
        ? {
            ...(initialValues.id != null && { id: initialValues.id }),
            period_type: initialValues.period_type,
            period_start: initialValues.period_start,
            metric_key: initialValues.metric_key,
            target_value: initialValues.target_value ?? 0,
            notes: initialValues.notes ?? null,
          }
        : undefined;

    return (
      <TargetForm
        {...(formInitialValues && { initialValues: formInitialValues })}
        onSuccess={onClose}
        mode={mode}
        {...(mode === 'create' && {
          usedKeysForPeriod,
        })}
      />
    );
  };

  return (
    <BaseDataTable<TargetRow>
      title=""
      data={rows}
      columns={columns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={(row) => row.id}
      onEdit={() => {}}
      onDelete={(id) => deleteMutation.mutate(Number(id))}
      renderForm={renderTargetForm}
      createButtonText="Add Target"
      formTitle="Add Target"
      editButtonText="Edit target"
      deleteButtonText="Delete target"
      deleteConfirmMessage="Are you sure you want to delete this target? You can add it again later."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      autoHeight
      enableExport
    />
  );
}
