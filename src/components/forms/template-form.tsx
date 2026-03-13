'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TextField,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import BaseForm from './base-form';
import {
  useMetricDefinitions,
  getMetricKeysForPeriod,
  getMetricDefinition,
  type PeriodType,
} from '@/lib/hooks/use-metric-definitions';

const templateFormSchema = z.object({
  period_type: z.enum(['WEEK', 'MONTH']),
  metric_key: z.string().min(1, 'Select a metric'),
  target_value: z.number().min(0),
  notes: z.string().nullable().optional(),
});

export type TemplateFormData = z.infer<typeof templateFormSchema>;

interface TemplateFormProps {
  initialValues?: Partial<TemplateFormData> & { id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  usedKeys?: Map<string, Set<string>>;
}

export default function TemplateForm({
  initialValues,
  onSuccess,
  mode = 'create',
  usedKeys,
}: TemplateFormProps) {
  const isEdit = mode === 'edit';
  const queryClient = useQueryClient();
  const { data: metrics = [], isLoading: metricsLoading } = useMetricDefinitions();

  const defaultPeriodType = (initialValues?.period_type ?? 'MONTH') as PeriodType;

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      period_type: defaultPeriodType,
      metric_key: initialValues?.metric_key ?? '',
      target_value: initialValues?.target_value ?? 0,
      notes: initialValues?.notes ?? null,
      ...initialValues,
    },
  });

  const periodType = watch('period_type');
  const metricKey = watch('metric_key');

  const availableMetrics = getMetricKeysForPeriod(metrics, periodType);
  const usedForType = usedKeys?.get(periodType);
  const metricsToPick = availableMetrics.filter(
    (k) => !usedForType?.has(k) || k === metricKey
  );

  const onSubmit = async (values: TemplateFormData) => {
    if (isEdit && initialValues?.id) {
      const periodChanged = values.period_type !== initialValues.period_type;
      const metricChanged = values.metric_key !== initialValues.metric_key;
      if (periodChanged || metricChanged) {
        await fetch('/api/operations/target-templates', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: initialValues.id }),
        });
      }
    }

    const res = await fetch('/api/operations/target-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateName: 'Default',
        metric_key: values.metric_key,
        period_type: values.period_type,
        target_value: values.target_value,
        notes: values.notes || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    queryClient.invalidateQueries({ queryKey: ['operations-target-templates'] });
    onSuccess?.();
  };

  const def = metricKey ? getMetricDefinition(metrics, metricKey) : null;
  const isPercent = def?.value_type === 'percent';
  const isCurrency = def?.value_type === 'currency';

  return (
    <BaseForm<TemplateFormData>
      onSubmit={onSubmit}
      onCancel={onSuccess}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      submitText={isEdit ? 'Update' : 'Add'}
    >
      <Controller
        name="period_type"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            select
            label="Period type"
            fullWidth
            required
            disabled={isEdit}
            error={!!errors.period_type}
            helperText={errors.period_type?.message}
            value={field.value}
            onChange={(e) => {
              const val = e.target.value as PeriodType;
              field.onChange(val);
              setValue('metric_key', '');
            }}
          >
            <MenuItem value="">
              <em>Select period type</em>
            </MenuItem>
            <MenuItem value="MONTH">Monthly</MenuItem>
            <MenuItem value="WEEK">Weekly</MenuItem>
          </TextField>
        )}
      />

      <Controller
        name="metric_key"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            select
            label="Metric"
            fullWidth
            required
            disabled={!periodType || metricsLoading || (isEdit && !!initialValues?.metric_key)}
            error={!!errors.metric_key}
            helperText={errors.metric_key?.message}
            value={field.value || ''}
            onChange={(e) => field.onChange(e.target.value)}
          >
            <MenuItem value="">
              <em>Select a metric</em>
            </MenuItem>
            {metricsToPick.map((key) => (
              <MenuItem key={key} value={key}>
                {metrics.find((m) => m.metric_key === key)?.label ?? key}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <Controller
        name="target_value"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            type="number"
            label="Target value"
            fullWidth
            required
            error={!!errors.target_value}
            helperText={errors.target_value?.message}
            value={field.value ?? ''}
            onChange={(e) =>
              field.onChange(
                e.target.value === '' ? 0 : Number(e.target.value)
              )
            }
            inputProps={{
              min: 0,
              max: isPercent ? 100 : undefined,
              step: isPercent ? 1 : undefined,
            }}
            {...(isCurrency && {
              InputProps: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
            })}
            {...(isPercent && !isCurrency && {
              InputProps: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
            })}
          />
        )}
      />

      <Controller
        name="notes"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Notes"
            fullWidth
            multiline
            rows={2}
            placeholder="Optional"
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value || null)}
          />
        )}
      />
    </BaseForm>
  );
}
