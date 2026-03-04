# Metric Definitions: Move from Code to Database

## Overview

Move metric definitions from `src/lib/metrics/metric-definitions.ts` (hardcoded) to a database table so metrics can be managed without code changes.

---

## 1. Database Schema

### New table: `metric_definitions`

```sql
CREATE TABLE metric_definitions (
  id            bigserial PRIMARY KEY,
  metric_key    text NOT NULL UNIQUE,
  label         text NOT NULL,
  value_type    text NOT NULL CHECK (value_type IN ('currency', 'count', 'percent', 'ratio')),
  period_types  text[] NOT NULL DEFAULT '{}',  -- e.g. ['WEEK','MONTH'] or ['MONTH']
  display_order int NOT NULL DEFAULT 0,        -- for consistent dropdown ordering
  active_flag   boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  updated_by    uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_metric_definitions_active ON metric_definitions (active_flag) WHERE active_flag = true;

COMMENT ON TABLE metric_definitions IS 'Business performance metrics available for targets. Replaces hardcoded metric-definitions.ts.';
```

### Optional: Foreign key on `metric_targets`

```sql
ALTER TABLE metric_targets
  ADD CONSTRAINT fk_metric_targets_metric_definitions
  FOREIGN KEY (metric_key) REFERENCES metric_definitions(metric_key);
```

**Note**: Add FK only after seeding data, and consider making it deferrable if you need to insert metric_targets before definitions exist during migrations.

---

## 2. Seed Data Migration

A migration must insert the current 15 metrics from code into `metric_definitions`:

| metric_key | label | value_type | period_types |
|------------|-------|------------|--------------|
| collections | Collections (Cash Collected) | currency | {WEEK,MONTH} |
| booked_sales | Booked Sales | currency | {MONTH} |
| pipeline_value | Pipeline Value | currency | {MONTH} |
| leads | Leads | count | {WEEK,MONTH} |
| show_rate_pct | Seminar Show Rate (%) | percent | {WEEK,MONTH} |
| cost_per_lead | Cost per Lead | currency | {WEEK,MONTH} |
| cost_per_attendee | Cost per Attendee | currency | {WEEK,MONTH} |
| pmes_scheduled | PMEs Scheduled | count | {WEEK,MONTH} |
| programs_won | Programs Won | count | {WEEK,MONTH} |
| close_rate_pct | Close Rate (%) | percent | {WEEK,MONTH} |
| avg_program_value | Avg Program Value | currency | {MONTH} |
| active_clients | Active Clients | count | {MONTH} |
| existing_client_revenue_pct | Revenue from Existing Clients (%) | percent | {MONTH} |
| ltv_avg | Avg LTV | currency | {MONTH} |

`display_order` can mirror the current METRIC_KEYS array order (1–15).

---

## 3. API Route

### New: `GET /api/operations/metrics` (or `GET /api/metrics`)

- **Auth**: Require authenticated user (same as targets).
- **Response**: JSON array of metric definitions, e.g.:
  ```json
  {
    "data": [
      {
        "id": 1,
        "metric_key": "collections",
        "label": "Collections (Cash Collected)",
        "value_type": "currency",
        "period_types": ["WEEK", "MONTH"],
        "display_order": 1,
        "active_flag": true
      },
      ...
    ]
  }
  ```
- **Filter**: Only return rows where `active_flag = true` (or all if admin needs to manage inactive).
- **Order**: `ORDER BY display_order ASC, metric_key ASC`.

---

## 4. React Hook

### New: `src/lib/hooks/use-metric-definitions.ts`

```ts
export function useMetricDefinitions() {
  return useQuery({
    queryKey: ['metric-definitions'],
    queryFn: async () => {
      const res = await fetch('/api/operations/metrics');
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return json.data as MetricDefinition[];
    },
  });
}
```

Export helpers:

- `getMetricKeysForPeriod(metrics: MetricDefinition[], periodType: PeriodType)` 
- `getMetricDefinition(metrics: MetricDefinition[] | undefined, key: string)`

Or keep these as pure functions that take the metrics array from the hook.

---

## 5. Changes to Existing Files

### 5.1 `src/components/forms/target-form.tsx`

| Current | Change |
|---------|--------|
| Import from `metric-definitions.ts` | Remove; use `useMetricDefinitions()` hook |
| `getMetricKeysForPeriod(periodType)` | Call helper with `metrics` from hook + `periodType` |
| `getMetricDefinition(metricKey)` | Call helper with `metrics` from hook + `metricKey` |
| `METRIC_DEFINITIONS[key].label` | Use `metrics.find(m => m.metric_key === key)?.label ?? key` |
| Loading state | Show loading indicator if `metrics` isLoading |
| Error state | Handle error from hook |

### 5.2 `src/components/targets/targets-table.tsx`

| Current | Change |
|---------|--------|
| Import `METRIC_DEFINITIONS`, `getMetricDefinition` | Use `useMetricDefinitions()` hook |
| `METRIC_DEFINITIONS[t.metric_key]?.label` | Use metrics from hook: `metrics?.find(m => m.metric_key === t.metric_key)?.label ?? t.metric_key` |
| `formatTargetValue(metricKey, value)` | Pass metrics from hook into a helper that looks up `value_type` |
| `renderTargetForm` | Pass `metrics` (or `metricDefinitions`) into TargetForm if needed |

### 5.3 `src/app/api/operations/targets/route.ts`

| Current | Change |
|---------|--------|
| `z.enum(METRIC_KEYS)` for validation | Query `metric_definitions` for valid keys, or validate with `SELECT metric_key FROM metric_definitions WHERE active_flag = true` and use dynamic enum / `.refine()` |
| `getMetricDefinition(metricKey)` for `validateTargetValue` | Query the row for that `metric_key` from `metric_definitions` to get `value_type`, then validate |

**Validation approach**:

- Replace static Zod enum with `z.string().refine()` that checks the key exists in the DB (or in a cached list from a single query at the start of the request).
- For `validateTargetValue`: fetch the definition for the given `metric_key` and use its `value_type` for validation logic.

---

## 6. Preserve `metric-definitions.ts` During Transition

**Option A – Clean removal**  
Remove the file once all usages are migrated. No fallback.

**Option B – Fallback**  
Keep the file as a fallback and use it only when the API fails or returns empty. Simplifies rollout but adds maintenance.

**Recommendation**: Option A. Ensure API and seed data are correct before removing the file.

---

## 7. TypeScript Types

### New / updated types

```ts
// In database.types.ts or a shared types file
export interface MetricDefinition {
  id: number;
  metric_key: string;
  label: string;
  value_type: 'currency' | 'count' | 'percent' | 'ratio';
  period_types: string[];  // ['WEEK','MONTH'] or ['MONTH']
  display_order: number;
  active_flag: boolean;
}
```

---

## 8. Migration Order

1. Create migration: `create_metric_definitions_table.sql` (schema + seed data).
2. Add API route `GET /api/operations/metrics`.
3. Add `useMetricDefinitions` hook.
4. Update TargetForm, TargetsTable, and targets API route.
5. Add FK on `metric_targets` (optional, in a separate migration).
6. Remove `src/lib/metrics/metric-definitions.ts` (or reduce to re-exports from API during transition).
7. Regenerate TypeScript types if using Supabase codegen.

---

## 9. Future: Admin UI (Optional)

A CRUD page under Operations or Admin could manage `metric_definitions` (add, edit, reorder, activate/deactivate). Not required for the initial migration.

---

## 10. Summary of File Changes

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDD_create_metric_definitions.sql` | **New** – create table + seed |
| `src/app/api/operations/metrics/route.ts` | **New** – GET endpoint |
| `src/lib/hooks/use-metric-definitions.ts` | **New** – React Query hook |
| `src/components/forms/target-form.tsx` | **Modify** – use hook, remove code imports |
| `src/components/targets/targets-table.tsx` | **Modify** – use hook, remove code imports |
| `src/app/api/operations/targets/route.ts` | **Modify** – validate via DB instead of code |
| `src/lib/metrics/metric-definitions.ts` | **Remove** (or gut and re-export from API during transition) |
| `src/types/database.types.ts` | **Modify** – add MetricDefinition if not generated |
