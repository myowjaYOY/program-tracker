'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TextField,
  MenuItem,
  InputAdornment,
  Box,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import BaseForm from './base-form';
import {
  useMetricDefinitions,
  getMetricKeysForPeriod,
  getMetricDefinition,
  type PeriodType,
} from '@/lib/hooks/use-metric-definitions';
import { startOfISOWeek, setISOWeek, setISOWeekYear, getISOWeek, getISOWeekYear, getISOWeeksInYear } from 'date-fns';

const targetFormSchema = z.object({
  period_type: z.enum(['WEEK', 'MONTH']),
  metric_key: z.string().min(1, 'Select a metric'),
  period_start: z.string().min(1, 'Select period'),
  target_value: z.number().min(0),
  notes: z.string().nullable().optional(),
});

export type TargetFormData = z.infer<typeof targetFormSchema>;

function toMonthStart(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Monday of ISO week in YYYY-MM-DD (local date to avoid timezone shift) */
function weekToPeriodStart(year: number, week: number): string {
  const d = new Date(year, 0, 4);
  const withYear = setISOWeekYear(d, year);
  const withWeek = setISOWeek(withYear, week);
  const monday = startOfISOWeek(withWeek);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function periodStartToWeek(periodStart: string): { year: number; week: number } {
  const d = new Date(periodStart + 'T12:00:00');
  return { year: getISOWeekYear(d), week: getISOWeek(d) };
}

function periodStartToMonth(periodStart: string): { year: number; month: number } {
  const parts = periodStart.split('-').map(Number);
  return { year: parts[0] ?? new Date().getFullYear(), month: parts[1] ?? 1 };
}

interface TargetFormProps {
  initialValues?: Partial<TargetFormData> & { id?: number };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  usedKeysForPeriod?: Map<string, Set<string>>;
}

export default function TargetForm({
  initialValues,
  onSuccess,
  mode = 'create',
  usedKeysForPeriod,
}: TargetFormProps) {
  const isEdit = mode === 'edit';
  const queryClient = useQueryClient();
  const { data: metrics = [], isLoading: metricsLoading } = useMetricDefinitions();

  const defaultPeriodType = (initialValues?.period_type ?? 'MONTH') as PeriodType;
  const defaultPeriodStart =
    initialValues?.period_start ??
    (defaultPeriodType === 'WEEK'
      ? weekToPeriodStart(getISOWeekYear(new Date()), getISOWeek(new Date()))
      : toMonthStart(new Date()));

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
  } = useForm<TargetFormData>({
    resolver: zodResolver(targetFormSchema),
    defaultValues: {
      period_type: defaultPeriodType,
      metric_key: initialValues?.metric_key ?? '',
      period_start: defaultPeriodStart,
      target_value: initialValues?.target_value ?? 0,
      notes: initialValues?.notes ?? null,
      ...initialValues,
    },
  });

  const periodType = watch('period_type');
  const periodStart = watch('period_start');
  const metricKey = watch('metric_key');

  const availableMetrics = getMetricKeysForPeriod(metrics, periodType);
  const usedForCurrentPeriod = periodType && periodStart ? usedKeysForPeriod?.get(`${periodType}|${periodStart}`) : undefined;
  const metricsToPick = availableMetrics.filter(
    (k) => !usedForCurrentPeriod?.has(k) || k === metricKey
  );

  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const onSubmit = async (values: TargetFormData) => {
    const targetPayload = {
      metric_key: values.metric_key,
      target_value: values.target_value,
      notes: values.notes || null,
    };

    if (isEdit && initialValues?.id) {
      const periodChanged =
        values.period_type !== initialValues.period_type ||
        values.period_start !== initialValues.period_start;
      const metricChanged = values.metric_key !== initialValues.metric_key;
      if (periodChanged || metricChanged) {
        await fetch('/api/operations/targets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: initialValues.id }),
        });
      }
    }

    const res = await fetch('/api/operations/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodType: values.period_type,
        periodStart: values.period_start,
        targets: [targetPayload],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    queryClient.invalidateQueries({ queryKey: ['operations-targets'] });
    onSuccess?.();
  };

  const def = metricKey ? getMetricDefinition(metrics, metricKey) : null;
  const isPercent = def?.value_type === 'percent';
  const isCurrency = def?.value_type === 'currency';

  return (
    <BaseForm<TargetFormData>
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
              setValue('period_start', '');
              if (val === 'MONTH') {
                setValue('period_start', toMonthStart(new Date(currentYear, currentMonth - 1, 1)));
              } else {
                const { year, week } = periodStartToWeek(new Date().toISOString().slice(0, 10));
                setValue('period_start', weekToPeriodStart(year, week));
              }
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

      {periodType === 'MONTH' && (
        <Controller
          name="period_start"
          control={control}
          render={({ field }) => (
            <TextField
              select
              label="Month"
              fullWidth
              required
              disabled={isEdit}
              error={!!errors.period_start}
              helperText={errors.period_start?.message}
              value={field.value || ''}
              onChange={(e) => field.onChange(e.target.value)}
            >
              <MenuItem value="">
                <em>Select month</em>
              </MenuItem>
              {years.flatMap((y) =>
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                  const ps = `${y}-${String(m).padStart(2, '0')}-01`;
                  const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  });
                  return (
                    <MenuItem key={ps} value={ps}>
                      {label}
                    </MenuItem>
                  );
                })
              )}
            </TextField>
          )}
        />
      )}

      {periodType === 'WEEK' && (
        <Controller
          name="period_start"
          control={control}
          render={({ field }) => (
            <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
              <FormControl fullWidth required error={!!errors.period_start} disabled={isEdit}>
                <InputLabel>Year</InputLabel>
                <Select
                  value={
                    field.value
                      ? periodStartToWeek(field.value).year
                      : currentYear
                  }
                  label="Year"
                  onChange={(e) => {
                    const year = Number(e.target.value);
                    const { week } = field.value
                      ? periodStartToWeek(field.value)
                      : { week: getISOWeek(new Date()) };
                    const w = Math.min(week, getISOWeeksInYear(year));
                    field.onChange(weekToPeriodStart(year, w));
                  }}
                >
                  {years.map((y) => (
                    <MenuItem key={y} value={y}>
                      {y}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required error={!!errors.period_start} disabled={isEdit}>
                <InputLabel>Week number</InputLabel>
                <Select
                  value={
                    field.value
                      ? periodStartToWeek(field.value).week
                      : getISOWeek(new Date())
                  }
                  label="Week number"
                  onChange={(e) => {
                    const week = Number(e.target.value);
                    const year = field.value
                      ? periodStartToWeek(field.value).year
                      : currentYear;
                    field.onChange(weekToPeriodStart(year, week));
                  }}
                >
                  {(() => {
                    const y = field.value
                      ? periodStartToWeek(field.value).year
                      : currentYear;
                    const count = getISOWeeksInYear(y);
                    return Array.from({ length: count }, (_, i) => i + 1).map((w) => {
                      const mondayStr = weekToPeriodStart(y, w);
                      const [my, mm, md] = mondayStr.split('-').map(Number);
                      const mondayDate = new Date(my ?? y, (mm ?? 1) - 1, md ?? 1);
                      const dateLabel = mondayDate.toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      });
                      return (
                        <MenuItem key={w} value={w}>
                          Week {w} ({dateLabel})
                        </MenuItem>
                      );
                    });
                  })()}
                </Select>
                <FormHelperText>
                  ISO week number (1–52 or 53)
                </FormHelperText>
              </FormControl>
            </Box>
          )}
        />
      )}

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
