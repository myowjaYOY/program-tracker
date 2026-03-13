# Supabase Support Request: Edge Function Invoked Twice Per pg_cron Trigger

**Date:** February 16, 2026  
**Project Ref:** mxktlbhiknpdauzoitnm  
**Severity:** High — causing duplicate financial records in production  

---

## Summary

Our `process-monthly-memberships` Edge Function is being invoked **twice** every night by a single `pg_cron` job, resulting in duplicate membership payments, duplicate program items, and corrupted financial totals for our members.

---

## Our Setup

We have a single pg_cron job (`cron.job`, jobid 2) that fires at `0 2 * * *` (2:00 AM UTC daily). It calls our Edge Function via `net.http_post`:

```sql
SELECT net.http_post(
  url := 'https://mxktlbhiknpdauzoitnm.supabase.co/functions/v1/process-monthly-memberships',
  headers := jsonb_build_object(
    'Authorization', 'Bearer <service_role_key>',
    'Content-Type', 'application/json'
  ),
  body := '{"triggered_by": "cron"}'::jsonb
);
```

There is only **one** entry in `cron.job` for this function. We verified:

```sql
SELECT jobid, jobname, schedule FROM cron.job
WHERE jobname ILIKE '%membership%' OR command ILIKE '%membership%';
-- Returns exactly 1 row: jobid=2, jobname='daily-membership-billing', schedule='0 2 * * *'
```

---

## The Problem

Every night, the Edge Function executes **twice**, approximately 300-500ms apart. Our function logs each execution to a `cron_job_runs` table at the start of every invocation. Here is evidence of the double-firing pattern:

| run_id | created_at (UTC)              | memberships_processed | total_payments_created |
|--------|-------------------------------|-----------------------|------------------------|
| 96     | 2026-02-28 02:00:02.112763    | 1                     | $350.00                |
| 97     | 2026-02-28 02:00:02.510808    | 1                     | $350.00                |
| 106    | 2026-03-05 02:00:01.706928    | 1                     | $499.00                |
| 107    | 2026-03-05 02:00:02.033116    | 1                     | $499.00                |
| 108    | 2026-03-06 02:00:01.167450    | 1                     | $300.00                |
| 109    | 2026-03-06 02:00:01.232097    | 1                     | $300.00                |
| 112    | 2026-03-08 02:00:00.838163    | 1                     | $499.00                |
| 113    | 2026-03-08 02:00:01.898163    | 0 (skipped)           | $0.00                  |

**Every single night shows two run records**, created within ~300-500ms of each other. The first run processes the membership; the second either also processes it (race condition) or skips it (idempotency check catches it if the first committed in time).

---

## Impact — Duplicate Data Created

When both executions race past each other's idempotency checks, we get:

### Example 1: Lauri Stufflebeme (program 252, start_date 2025-12-10)

| payment_id | due_date   | notes                      | created_at (UTC)              |
|-----------|------------|----------------------------|-------------------------------|
| 992       | 2026-03-10 | Month 4 membership payment | 2026-02-28 02:00:03.364036    |
| 993       | 2026-03-10 | Month 5 membership payment | 2026-02-28 02:00:03.402778    |

Both created within **38ms** of each other. Both have the **same** `payment_due_date` of 2026-03-10. Month 5's due date should have been 2026-04-10.

### Example 2: Amy Burden (program 227, start_date 2025-12-15)

| payment_id | due_date   | notes                      | created_at (UTC)              |
|-----------|------------|----------------------------|-------------------------------|
| 1000      | 2026-03-15 | Month 4 membership payment | 2026-03-05 02:00:02.777395    |
| 1001      | 2026-03-15 | Month 5 membership payment | 2026-03-05 02:00:03.459974    |

Both created within **682ms**. Same `payment_due_date`. Same problem.

### Beyond payments

Each run also clones program items, updates cumulative financial totals (discounts, taxes, final_total_price), and updates program duration. So the double execution also results in:
- **Duplicate program items** (double the items for a billing period)
- **Double-incremented financial totals** (discounts, taxes, final_total_price all inflated by 2x for that month)
- **Duration inflated** by an extra 30 days

---

## Race Condition Explanation

Our Edge Function has an idempotency check:

```typescript
const { data: existingPayment } = await supabase
  .from("member_program_payments")
  .select("member_program_payment_id")
  .eq("member_program_id", programId)
  .eq("payment_due_date", membership.next_billing_date)
  .eq("active_flag", true)
  .maybeSingle();

if (existingPayment) {
  // skip
  continue;
}
```

When both invocations start within ~300ms, **neither** sees the other's payment because neither has inserted yet when the other checks. Both proceed to create a payment with the same `payment_due_date`, clone items, update totals, etc.

---

## What We Need From Supabase

1. **Why is `net.http_post` (or the Edge Function infrastructure) delivering the request twice?** We have a single `cron.job` entry. The double execution has occurred every single night since the function was deployed. Is this a known issue with `net.http_post` or Edge Function invocation?

2. **Is there a configuration or workaround** to ensure exactly-once delivery from pg_cron → Edge Function?

3. **Logs from the infrastructure side** — can you confirm whether the Edge Function received one or two HTTP requests on any of the dates listed above (e.g., 2026-03-05 around 02:00 UTC)?

---

## Workaround We're Considering

We plan to add a database-level advisory lock or unique constraint to prevent the race condition on our side, but we'd still like to understand and resolve the root cause of the double invocation.

---

## How to Reproduce

This happens every night automatically. Check `cron_job_runs` for `job_name = 'process_monthly_memberships'` — every date has two records.

```sql
SELECT run_id, created_at, memberships_processed, memberships_skipped
FROM cron_job_runs
WHERE job_name = 'process_monthly_memberships'
ORDER BY created_at DESC
LIMIT 20;
```

Thank you for looking into this.
