# CEO Executive Dashboard — Investigation Document

This document provides a comprehensive technical investigation of the Program Tracker codebase to enable an external architect to design and instruct implementation of a CEO-level Executive Dashboard. **No code changes, database modifications, or migrations are specified here.**

---

## SECTION 1: TECH STACK & ARCHITECTURE

### Framework
- **Next.js**: Version **15.5.3** (from `package.json`).
- **Router**: **App Router** only. All routes live under `src/app/` (e.g. `src/app/dashboard/`, `src/app/api/`).
- **React**: 19.x. UI uses **MUI (Material UI)** 7.x, **Emotion**, **@mui/x-data-grid**, **@mui/x-charts**, **Recharts**, **TanStack React Query**, **React Hook Form**, **Zod**.

### Supabase Access
- **Client creation**:
  - **Browser**: `src/lib/supabase/client.ts` — `createBrowserClient()` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - **Server**: `src/lib/supabase/server.ts` — `createServerClient()` from `@supabase/ssr` with cookie handling via `next/headers` `cookies()`. No service-role client in app code.
- **Usage pattern**: All report and dashboard data access goes through **Next.js API routes** (Route Handlers under `src/app/api/`). Server-side code calls `createClient()` from `@/lib/supabase/server` and uses the returned Supabase client. There is **no use of Supabase RPC** for the reports analyzed; all data is fetched via `.from('table').select(...)` style queries.
- **Auth**: API routes call `supabase.auth.getUser()` or `supabase.auth.getSession()` and return 401 when unauthenticated.

### Query Structure
- **No raw SQL in application code** for the report/dashboard APIs reviewed. All queries use the **Supabase JavaScript client** (query builder): `.from('table').select(...).eq(...).in(...).gte(...).lte(...)` etc.
- **No repository pattern**. Each API route builds its own Supabase query and, where needed, performs in-memory filtering/aggregation (e.g. date filters, status maps, campaign metrics).
- **Centralized status logic**: `src/lib/services/program-status-service.ts` — `ProgramStatusService.getValidProgramIds(supabase, options?)` returns program IDs for “valid” programs (default: **Active** only; optional `includeStatuses`: `'paused'`, `'quote'`, `'completed'`, `'cancelled'`, `'lost'`, `'all'`). Used by dashboard, payments, coordinator, and report-card APIs to avoid hard-coding status IDs.

### Where Reports Live
- **API routes (data)**:
  - **Sales / Executive**: `src/app/api/sales-reports/executive-dashboard/route.ts`, `src/app/api/sales-reports/monthly-sales/route.ts`, `src/app/api/sales-reports/sales-tax/route.ts`.
  - **Marketing / Campaign**: `src/app/api/reports/campaign-performance/route.ts`.
  - **Dashboard metrics**: `src/app/api/dashboard/metrics/route.ts`, `src/app/api/dashboard/active-members/route.ts`.
  - **Report card (delivery/clinical)**: `src/app/api/report-card/dashboard-metrics/route.ts`, `src/app/api/report-card/participants/route.ts`, and other `src/app/api/report-card/*` routes.
  - **Payments**: `src/app/api/payments/metrics/route.ts`, `src/app/api/payments/route.ts`.
  - **Coordinator**: `src/app/api/coordinator/metrics/route.ts`, `src/app/api/coordinator/todo/route.ts`, `src/app/api/coordinator/script/route.ts`.
  - **Analytics**: `src/app/api/analytics/metrics/route.ts`, `src/app/api/analytics/compliance-trends/route.ts`, etc.
- **Pages (UI)**:
  - **Dashboard home**: `src/app/dashboard/page.tsx`.
  - **Sales reports**: `src/app/dashboard/sales/reports/page.tsx`.
  - **Other report/dashboard UIs**: `src/app/dashboard/reports/page.tsx`, `src/app/dashboard/report-card/page.tsx`, `src/app/dashboard/payments/page.tsx`, `src/app/dashboard/coordinator/page.tsx`, `src/app/dashboard/program-analytics/page.tsx`, `src/app/dashboard/admin/analytics/page.tsx`.

### Shared Utilities
- **Program status**: `src/lib/services/program-status-service.ts` (see above).
- **Financial calculations**: `src/lib/utils/financial-calculations.ts` — e.g. `calculateProjectedPrice`, `calculateMarginOnLockedPrice`, `calculateVariance`, `validateActiveProgramChanges`. Used for program/item pricing and margin validation, not for high-level revenue reporting.
- **Types**: `src/types/database.types.ts` — hand-maintained TypeScript interfaces for Supabase tables (e.g. `Leads`, `MemberPrograms`, `MemberProgramFinances`, `Campaigns`, `Status`, `ProgramStatus`). Comment at top says types should be generated from Supabase.

---

## SECTION 2: DOMAIN MODEL INVENTORY

Relevant tables for a CEO dashboard, with columns, keys, and notes. **Primary keys** are the first column listed per table unless noted. **Foreign keys** are summarized; exact constraint names can be read from the database.

### leads
- **Table**: `public.leads`
- **Columns**: `lead_id` (PK, serial), `first_name`, `last_name`, `email`, `phone`, `status_id` (FK → status), `campaign_id` (FK → campaigns), `pmedate` (date, nullable — PME/appointment date), `active_flag`, `created_at`, `created_by`, `updated_at`, `updated_by`
- **Monetary**: none
- **Notes**: No soft delete; `active_flag` exists. “Client” or “patient” is represented by a lead; once they have a program they are still identified by `lead_id` on `member_programs`.

### Seminar / event and “registrations”
- **campaigns** (seminar/event):
  - **Table**: `public.campaigns`
  - **Columns**: `campaign_id` (PK), `campaign_name`, `campaign_date` (date), `description`, `confirmed_count` (integer), `vendor_id` (FK → vendors), `ad_spend` (numeric), `food_cost` (numeric), `active_flag`, `created_at`, `created_by`, `updated_at`, `updated_by`
  - **Monetary**: `ad_spend`, `food_cost`
- **“Registrations”**: There is **no separate seminar_registrations table**. A lead is linked to one campaign via `leads.campaign_id`. So “seminar registrations” = leads where `campaign_id` = that campaign.
- **Seminar attendance / show**: There is **no dedicated attendance table**. “Showed up” is inferred from **audit history**: `audit_events` + `audit_event_changes` for `table_name = 'leads'` and `column_name = 'status_id'`. A lead who transitioned **Confirmed → No Show** is treated as no-show; others who are counted as “total leads” for the event and are not no-shows are treated as attended. See Section 3.

### status (lead status)
- **Table**: `public.status`
- **Columns**: `status_id` (PK), `status_name`, `description`, `active_flag`, `created_at`, `created_by`, `updated_at`, `updated_by`
- **Enum-like values** (from DB): `No PME` (1), `PME Scheduled` (2), `Lost` (3), `Won` (4), `Confirmed` (5), `Follow Up` (11), `UNK` (12), `No Program` (13), `No Show` (14). Used for lead funnel (seminar → PME → won/lost).

### audit_events and audit_event_changes
- **audit_events**: `event_id` (PK), `table_name`, `record_id`, `record_pk`, `operation`, `actor_user_id`, `event_at` (timestamptz), `scope`, `related_member_id`, `related_program_id`, `summary`, `context`, `old_row`, `new_row`. No `created_at`; `event_at` is the audit time.
- **audit_event_changes**: `event_id` (FK), `column_name`, `old_value` (jsonb), `new_value` (jsonb). Used to detect status transitions (e.g. `status_id` changes on `leads`) for show rate and PME scheduling.

### Consults / appointments
- There is **no separate consults or appointments table**. The closest is:
  - **leads.pmedate**: date when the PME (consult) was or is scheduled.
  - PME “scheduled” state is inferred from lead `status_id` = PME Scheduled and/or audit history showing a transition to PME Scheduled.

### Enrollments / program purchases (program instances)
- **member_programs** (program instance per lead):
  - **Table**: `public.member_programs`
  - **Columns**: `member_program_id` (PK), `program_template_name`, `description`, `total_cost`, `total_charge`, `lead_id` (FK → leads), `start_date`, `active_flag`, `program_status_id` (FK → program_status), `source_template_id`, `template_version_date`, `created_at`, `created_by`, `updated_at`, `updated_by`, `duration`, `program_type` ('one-time' | 'membership'), `next_billing_date`
  - **Monetary**: `total_cost`, `total_charge` (template-level totals; actual locked/contract price is in `member_program_finances.final_total_price`).
- **program_status** (program lifecycle):
  - **Table**: `public.program_status`
  - **Values**: `Active` (1), `Completed` (2), `Paused` (3), `Cancelled` (4), `Quote` (6), `Lost` (7). Used to filter “sold” (Active + Completed), “pipeline” (Quote), etc.

### Invoices and contract price
- **No standalone invoices table**. The financial snapshot for a program is:
- **member_program_finances**:
  - **Table**: `public.member_program_finances`
  - **Columns**: `member_program_finance_id` (PK), `member_program_id` (FK), `finance_charges`, `taxes`, `discounts`, `final_total_price`, `margin`, `financing_type_id`, `contracted_at_margin`, `variance`, `created_at`, `created_by`, `updated_at`, `updated_by`
  - **Monetary**: `finance_charges`, `taxes`, `discounts`, `final_total_price`, `margin`, `contracted_at_margin`, `variance`
  - **Notes**: One row per program (1:1 with member_programs). `final_total_price` is the locked/contracted price for the program (used as “booked” revenue when status is Active/Completed). Margin is stored as percentage.

### Payments (collections)
- **member_program_payments**:
  - **Table**: `public.member_program_payments`
  - **Columns**: `member_program_payment_id` (PK), `member_program_id` (FK), `payment_amount`, `payment_due_date`, `payment_date` (nullable — set when paid), `payment_status_id` (FK → payment_status), `payment_method_id`, `payment_reference`, `notes`, `active_flag`, `created_at`, `created_by`, `updated_at`, `updated_by`
  - **Monetary**: `payment_amount`
  - **Notes**: `payment_status_id` → payment_status: e.g. Pending (1), Paid (2), Late (3), Cancelled (4). “Collections” = sum of `payment_amount` where `payment_date` in period and status = Paid. Filtering often uses `active_flag = true`.
- **payment_status**: `payment_status_id`, `payment_status_name`, `payment_status_description`, `active_flag`, created/updated.
- **payment_methods**: `payment_method_id`, `method_name`, `description`, `active_flag`, created/updated.

### Clients / patients
- **No separate clients table**. “Client” = lead with at least one program. Identity is `leads.lead_id`; name/contact from `leads.first_name`, `last_name`, `email`, `phone`.

### Program structure (items and schedule)
- **member_program_items**: `member_program_item_id` (PK), `member_program_id`, `therapy_id`, `quantity`, `item_cost`, `item_charge`, `days_from_start`, `days_between`, `instructions`, `program_role_id`, `active_flag`, `billing_period_month`, created/updated.
- **member_program_item_schedule**: `member_program_item_schedule_id` (PK), `member_program_item_id`, `instance_number`, `scheduled_date`, `completed_flag`, `program_role_id`, created/updated. Used for therapy “visits” and for sales-tax report (redemption by `scheduled_date`, `completed_flag = true`).
- **member_program_item_tasks**, **member_program_items_task_schedule**: Task and to-do scheduling; not required for CEO revenue/collections metrics.

### Cancellations / status changes
- **Program status**: `program_status` and `program_status_transitions` (transition history). Status IDs used in code: Active 1, Completed 2, Paused 3, Cancelled 4, Quote 6, Lost 7.
- **Lead status**: `status` and `lead_status_transitions`; changes also visible in `audit_events` for `leads.status_id`.
- **Payment**: `payment_status_id` = Cancelled for cancelled payments.

### Costs
- **Program-level**: `member_programs.total_cost`, `member_program_finances.margin` (and related). Item-level: `member_program_items.item_cost`, `therapies.cost`.
- **Campaign-level**: `campaigns.ad_spend`, `campaigns.food_cost`. No general “overhead” or “fixed cost” table.

### Staff / providers
- **users** (auth + app users): `id` (uuid), `email`, `full_name`, `is_admin`, `is_active`, `program_role_id` (FK → program_roles), `app_source`, `created_at`, `updated_at`. Used for “who did what,” not for staffing cost or FTE.
- **program_roles**: e.g. Coordinator, Admin, Nurse, Provider, Manager, etc. No table for “staff cost” or “provider capacity.”

### Other relevant tables
- **member_program_membership_finances**: For membership programs; `monthly_rate`, `monthly_discount`, `monthly_tax`, `billing_frequency`. Used for recurring billing, not for a single “revenue” number.
- **financing_types**: Internal/external financing; referenced by `member_program_finances.financing_type_id`.
- **vendors**: Linked to campaigns; not used for CEO financial totals.
- **therapies**, **therapy_tasks**, **program_template**, **program_template_items**: Used for program construction and delivery, not for CEO P&L.

---

## SECTION 3: EXISTING REPORTS ANALYSIS

### 3.1 Executive Dashboard
- **File**: `src/app/api/sales-reports/executive-dashboard/route.ts`
- **Metrics**: Summary: `totalRevenue`, `pipelineValue`, `avgProgramValue`, `avgMargin`, `conversionRate`. Per-campaign: `pme_scheduled`, `pme_no_shows`, `programs_won`, `pme_win_percentage`, `campaign_cost`, `cost_per_customer`, `total_revenue`, `roi_percentage`.
- **Query pattern**: Fetches `campaigns` with `leads` (and lead `status`), `member_programs` with `member_program_finances` (filtered by `program_status_id` in Active, Completed, Quote). Uses `audit_events` + `audit_event_changes` for lead `status_id` to determine PME scheduled date and no-shows. Date filter applied in memory to programs (`start_date` for Active/Completed, `created_at` for Quote) and to PME counts (audit transition date or `leads.pmedate`).
- **Time window**: Query params `range` (this_year, last_year, this_month, last_month, this_quarter, last_quarter, custom, all) and optional `startDate`/`endDate`. Date logic in `getDateRange()` in the same file.
- **Revenue**: `member_program_finances.final_total_price` summed for programs with `program_status_id` Active or Completed, filtered by date on `start_date` (or `created_at` for Quote for pipeline).
- **Show rate**: Not computed in this route. PME no-shows are counted (leads who had PME scheduled but current status No Show).
- **Close rate**: `conversionRate` = (summary total programs won) / (summary total PMEs scheduled in range) × 100. “Programs won” = count of programs (Active + Completed) in filtered set; “PMEs scheduled” = count of unique leads with `pmedate` in the date range.

### 3.2 Monthly Sales
- **File**: `src/app/api/sales-reports/monthly-sales/route.ts`
- **Metrics**: Per-month `conversionRate` (Event → PME %), `pmeWinRate` (PME → Win %), `totalRevenue`. Summary: `totalPMEsScheduled`, `totalProgramsWon`, `pendingPMEs`.
- **Query pattern**: Same as executive dashboard for campaigns, leads, programs, finances, and audit. Builds monthly buckets; two PME counts: `pmeScheduledCampaign` (campaign-based, for Event → PME %) and `pmeScheduledByDate` (by `pmedate`, for PME → Win %).
- **Time window**: Same `range` and custom dates.
- **Show rate**: Not named; “showed up” = totalLeads − noShows in month; Event → PME % = pmeScheduledCampaign / showedUp.
- **Close rate**: `pmeWinRate` = programsWon in month / pmeScheduledByDate in month × 100.
- **Revenue**: Same as executive: `final_total_price` for Active/Completed, by `start_date` month.

### 3.3 Campaign Performance
- **File**: `src/app/api/reports/campaign-performance/route.ts`
- **Metrics**: Per campaign: `total_leads`, `no_shows`, `no_pmes`, `show_rate`, `pme_scheduled`, `conversion_rate`, `total_cost`, `cost_per_lead`.
- **Query**: Campaigns with leads and lead status; audit for status_id on leads. No program/finance data in this route.
- **Show rate**: `show_rate` = (totalLeads − noShows) / totalLeads × 100. Total leads = max(campaign.confirmed_count, actual lead count). No-shows = leads with audit transition Confirmed → No Show (or current status No Show if no audit).
- **Close rate**: Not in this report. `conversion_rate` = (pme_scheduled / showedUp) × 100 (Event → PME %).
- **Revenue**: None in this route.
- **Time window**: None in the route; returns all campaigns.

### 3.4 Report Card Dashboard Metrics
- **File**: `src/app/api/report-card/dashboard-metrics/route.ts`
- **Metrics**: Delivery/clinical: totalActiveMembers, membersWithProgress, progressPercentage, avgSupportRating, lowSupportRatingCount/List, programsEndingSoon, endingSoonList, worstMsqCount/List/Average, behindScheduleCount/List, worstComplianceCount/List/Average, bestProgressCount/List/Average. No revenue or sales metrics.
- **Query**: Uses `ProgramStatusService.getValidProgramIds()` (Active only), then member_programs, member_progress_summary, survey_response_sessions, survey_responses, survey_domain_scores, member_program_item_schedule, member_program_item_tasks, member_program_items_task_schedule. No show rate or close rate.

### 3.5 Payments Metrics
- **File**: `src/app/api/payments/metrics/route.ts`
- **Metrics**: totalAmountOwed, totalAmountDue (amount paid this month), totalAmountLate, totalAmountCancelled, membersWithPaymentsDue, latePaymentsBreakdown, cancelledPaymentsBreakdown.
- **Query**: Programs via ProgramStatusService (Active+Paused for operational; “all” for cancelled/paid-this-month). member_program_payments with payment_status join. “Amount paid this month” = payments where `payment_date` between month start and month end (server local time).
- **Collections**: “Amount paid this month” is effectively **Collections MTD**: sum of `payment_amount` where `payment_status` = Paid and `payment_date` in current calendar month.
- **Time window**: Month boundaries from server `Date` (monthStart/monthEnd).

### 3.6 Dashboard Metrics (main dashboard)
- **File**: `src/app/api/dashboard/metrics/route.ts`
- **Metrics**: activeMembers (unique lead_id with Active programs), newProgramsThisMonth (Active programs with start_date in current month), completedPrograms (program_status_id = Completed), pausedPrograms. No revenue or collections.

### 3.7 Sales Tax Report
- **File**: `src/app/api/sales-reports/sales-tax/route.ts`
- **Purpose**: Redeemed items with sales tax (8.25% on taxable). Uses `member_program_item_schedule` (completed_flag = true), joined to items, programs, leads, finances (discounts), therapies (taxable). Date filter on `scheduled_date` (redemption date). Not a revenue total for CEO.

### Duplicated logic
- **Date range helper**: Same `getDateRange(range, startDate, endDate)` pattern in executive-dashboard and monthly-sales (duplicated switch/cases).
- **Status IDs**: Fetched by name in each route (e.g. status map for Active, Completed, Quote, PME Scheduled, No Show, Confirmed). program_status and status tables are the source; no single shared constant set in code.
- **Audit map for leads**: Executive-dashboard and monthly-sales and campaign-performance all build an “audit map” of lead_id → status change history from audit_events + audit_event_changes for leads.status_id.
- **Revenue**: Always `member_program_finances.final_total_price` for Active/Completed; date filter on `member_programs.start_date` (or created_at for Quote).

---

## SECTION 4: METRIC FEASIBILITY ANALYSIS

For each CEO metric: **AVAILABLE** = can be computed from current schema and existing patterns; **PARTIAL** = partially possible or ambiguous; **MISSING** = data or definition not present.

### Financial

| Metric | Status | Required tables | Required joins / filters | Date filters | Ambiguities / edge cases | If missing |
|--------|--------|------------------|---------------------------|--------------|---------------------------|------------|
| **Cash in bank** | **MISSING** | — | — | — | No bank balance or bank transaction table. | New table or integration for bank balance / transactions. |
| **Monthly fixed overhead** | **MISSING** | — | — | — | No overhead or fixed-cost table. campaigns have ad_spend/food_cost per event only. | New table (e.g. monthly_overhead or budget line items). |
| **Collections (Cash Collected MTD)** | **AVAILABLE** | member_program_payments, payment_status | Where payment_status_name = 'Paid' and payment_date in current month | payment_date in [monthStart, monthEnd] (MTD) | Use payment_date (date paid), not payment_due_date. Exclude cancelled. active_flag = true typically used. | — |
| **Sales (Booked Revenue MTD)** | **AVAILABLE** | member_programs, member_program_finances | program_status_id in (Active, Completed); join to finances | start_date (or created_at for Quote) in current month for “booked” | “Booked” = when program is sold (start_date for Active/Completed). Quote pipeline could use created_at. | — |
| **Gross margin %** | **PARTIAL** | member_programs, member_program_finances | Same as Sales; need margin and revenue | Same as Sales | margin is stored as % in member_program_finances. Aggregate: can do revenue-weighted average margin (sum(margin * final_total_price) / sum(final_total_price)) for period. Cost not stored at program level in one place (total_cost on member_programs vs item costs). | Clarify: program-level margin % vs company-level; cost basis (contracted price vs delivered). |

### Marketing

| Metric | Status | Required tables | Required joins / filters | Date filters | Ambiguities / edge cases | If missing |
|--------|--------|------------------|---------------------------|--------------|---------------------------|------------|
| **Leads (30d)** | **PARTIAL** | leads, campaigns | leads where campaign_id not null; campaign_date or lead created_at in last 30d | Need definition: campaign_date of their campaign vs lead created_at | Duplicate leads across campaigns not modeled (lead has one campaign_id). | Define “lead” window (e.g. lead created in 30d, or campaign in 30d). |
| **Cost per lead** | **PARTIAL** | campaigns (ad_spend, food_cost), leads | Sum ad_spend+food_cost for campaigns in window; count leads in same window | Campaign date or lead creation | Which window (campaign date vs lead date); which campaigns (only those with leads in window?). | Same as above. |
| **Seminar show rate %** | **AVAILABLE** | campaigns, leads, audit_events, audit_event_changes, status | Total leads per campaign; no-shows = Confirmed→No Show in audit; show rate = (total - noShows)/total * 100 | Optional: campaign_date in range | total_leads = max(confirmed_count, count(leads)). No-shows require audit or fallback to current status. | — |
| **Cost per attendee** | **AVAILABLE** | Same as show rate | campaign cost / (total leads - noShows) for campaigns in scope | Same | Denom = “showed up”; cost = ad_spend + food_cost. | — |

### Sales

| Metric | Status | Required tables | Required joins / filters | Date filters | Ambiguities / edge cases | If missing |
|--------|--------|------------------|---------------------------|--------------|---------------------------|------------|
| **Close rate %** | **PARTIAL** | leads (pmedate), member_programs, program_status, audit (optional) | PME scheduled in period = leads with pmedate in period (or audit); programs won = Active+Completed with start_date in period. Rate = programs_won / pme_scheduled. | pmedate and start_date in same or aligned window | Definition: same month vs “PME in month → program within N days.” Multiple programs per lead can double-count “won.” | Decide denominator (unique PMEs) and numerator (programs or unique clients). |
| **Avg program value** | **AVAILABLE** | member_programs, member_program_finances | Active + Completed; avg(final_total_price) | start_date in window | — | — |
| **New enrollments (30d)** | **AVAILABLE** | member_programs, program_status | program_status_id in (Active, Completed); start_date in last 30 days | start_date in last 30d | Count programs vs unique leads (one lead can have multiple programs). | — |

### Delivery

| Metric | Status | Required tables | Required joins / filters | Date filters | Ambiguities / edge cases | If missing |
|--------|--------|------------------|---------------------------|--------------|---------------------------|------------|
| **Active clients** | **AVAILABLE** | member_programs, program_status | program_status_id = Active; count distinct lead_id | Optional: as of date (no status history, so “as of today” only) | Paused sometimes included operationally; default is Active only. | — |
| **Dropout %** | **PARTIAL** | member_programs, program_status | Need definition: e.g. Cancelled+Paused as “dropout” vs Active+Completed as “retained”; denominator = programs started in a cohort | Cohort start_date window; status at end of window or current | No program_status transition history in reports; only current status. “Dropout” = Cancelled? Paused? And over what period? | Define cohort and dropout (e.g. moved to Cancelled/Paused after start). |
| **Revenue from existing clients %** | **PARTIAL** | member_programs, member_program_finances, leads | “Existing” = had program before period start; “new” = first program in period. Revenue in period = sum final_total_price for programs starting in period; split by new vs existing client | start_date in period; need “first program” date per lead | Requires “first program” per lead (min start_date) and revenue attributed to period (e.g. by start_date). | Logic exists in principle; no existing report. |
| **LTV (or proxy)** | **PARTIAL** | member_programs, member_program_finances | Sum final_total_price per lead over all their programs (Active+Completed); optionally include Paid payments | All time or by cohort | No future revenue projection. LTV = historical sum per client; repeat programs = multiple rows. | — |

---

## SECTION 5: TARGETS / BUDGET GAP

### Existence of target/budget data
- **No `targets` table** exists in the schema.
- **No config table** was found that stores monthly (or any) targets for revenue, collections, enrollments, or other CEO metrics. Grep for “target” and “budget” in the codebase found only: notification `target_role_ids`, UI “Member Goals” (program description), and “target” in analytics (e.g. “below target” for compliance). None of these represent business targets or budgets.

### Minimal schema suggestion (description only)
To support monthly targets for a CEO dashboard without changing existing behavior, a minimal approach could be:

- **Table**: e.g. `monthly_targets` or `ceo_targets`.
- **Suggested columns**: `id`, `target_type` (e.g. 'revenue', 'collections', 'enrollments', 'active_clients'), `year`, `month`, `target_value` (numeric), optional `notes`, `created_at`, `updated_at`. Optional: `scope` (e.g. 'company' vs future location).
- **Usage**: Dashboard reads targets for the selected month/year and compares to computed metrics (revenue, collections, etc.) from existing logic. No implementation is specified here.

---

## SECTION 6: DATA INCONSISTENCIES & RISKS

### Multiple definitions of revenue
- **Booked revenue**: In sales reports, “revenue” = sum of `member_program_finances.final_total_price` for programs with status Active or Completed, filtered by `start_date` (or `created_at` for Quote for pipeline). There is no other “revenue” total in the same reports.
- **Risk**: If other features (e.g. partial delivery, refunds, credits) are stored elsewhere and not reflected in `final_total_price` or status, booked revenue could be overstated. Payments “collections” are separate (actual cash).

### Multiple definitions of show rate
- **Campaign Performance** (`reports/campaign-performance`): `show_rate` = (totalLeads − noShows) / totalLeads. totalLeads = max(campaign.confirmed_count, actual lead count). noShows = Confirmed → No Show in audit (or current status No Show).
- **Monthly Sales** (concept): “showed up” = totalLeads − noShows; used for Event → PME % (conversionRate). Same idea as above but in a monthly bucket.
- **Risk**: Slight differences if confirmed_count is used in one place and not another; or if “total leads” is interpreted as “unique leads” when a lead could appear in multiple campaigns (currently one campaign per lead).

### Multiple definitions of close rate
- **Campaign Performance**: `conversion_rate` = (pme_scheduled / showedUp) × 100. This is **Event → PME %** (seminar to PME scheduled), not PME → sale.
- **Executive Dashboard**: `conversionRate` = (summary programs won) / (summary PMEs scheduled in range) × 100. This is **PME → Win %** (PME to program sold).
- **Monthly Sales**: `pmeWinRate` = programsWon / pmeScheduledByDate × 100 (same as executive). So “close rate” in the CEO sense (PME → sale) is only in executive and monthly-sales; campaign-performance uses “conversion” for Event → PME. Naming is inconsistent.

### Hard-coded status values
- **program_status_id = 1 (Active)**: Hard-coded in `src/app/api/dashboard/active-members/route.ts` (`eq('program_status_id', 1)`). Elsewhere, status is resolved by name via `program_status` (e.g. ProgramStatusService, executive-dashboard, monthly-sales). If status IDs ever change, active-members would be wrong unless updated.
- **Lead status names**: Code uses string names ('PME Scheduled', 'No Show', 'Confirmed', 'Won', 'Lost', 'No Program', 'No PME') from `status` table. IDs are looked up at runtime; no enum in code.

### Double-counting risks
- **Programs won**: One lead can have multiple programs (Active or Completed). Summing “programs” counts each program; revenue sums each program’s final_total_price. So revenue can be > “one program per client” if same client has multiple programs. Not double-counting payments, but “new enrollments” vs “new clients” can differ.
- **PME scheduled**: Executive dashboard counts unique leads with pmedate in range; monthly-sales has both campaign-based and pmedate-based counts. If a lead has pmedate set and also appears in a campaign, they are counted in “total leads” for that campaign; PME count by pmedate is per lead. Generally consistent if one PME per lead.

### Timezone and date-boundary risks
- **Server time**: Date ranges (month start/end, “today”) are built with JavaScript `Date` in API routes (server). So “MTD” and “current month” depend on server timezone, not user or client timezone.
- **Stored dates**: `member_programs.start_date`, `leads.pmedate`, `member_program_payments.payment_date` are `date` type; no time. `audit_events.event_at` is timestamptz. Filtering by “month” uses date strings (YYYY-MM-DD); boundary is midnight in server’s interpretation.

---

## SECTION 7: RECOMMENDED CANONICAL DEFINITIONS

Proposed single definitions that align with current data and existing report logic. **Not implemented**; for architect/implementation reference.

| Metric | Recommended canonical definition |
|--------|-----------------------------------|
| **Seminar show rate** | For a given set of seminar/campaigns (or a time window by campaign_date): **Show rate % = (Total leads − No-shows) / Total leads × 100.** Total leads = per campaign, max(campaign.confirmed_count, count(leads with that campaign_id)). No-shows = leads who have audit transition from status Confirmed to No Show, or (if no audit) current status = No Show. |
| **Close rate** | **Close rate % = (Programs won in period) / (PMEs scheduled in period) × 100.** Programs won = count of member_programs with program_status_id in (Active, Completed) and start_date in the period. PMEs scheduled in period = count of distinct lead_ids where leads.pmedate is in the period. Use same period (e.g. calendar month) for both. |
| **Sales (Booked)** | **Booked revenue (MTD or period) = Sum of member_program_finances.final_total_price for member_programs where program_status_id in (Active, Completed) and start_date is within the period.** One row per program; no proration. |
| **Collections** | **Collections (MTD or period) = Sum of member_program_payments.payment_amount where payment_status_id corresponds to Paid and payment_date is within the period.** Only include rows with active_flag = true. Exclude Cancelled. |
| **Active client** | **Active client = A lead_id that has at least one member_program with program_status_id = Active.** Count = distinct lead_id. Optionally include Paused for “operational” active count (match ProgramStatusService with includeStatuses: ['paused']). |
| **Dropout** | **Dropout % (for a cohort) = (Programs in cohort that are now Cancelled or Paused) / (Programs in cohort) × 100.** Cohort = programs with start_date in a defined start window. “Now” = current program_status_id. Requires no status history; snapshot only. Refinements (e.g. exclude Paused, or time-bound “within N months”) can be added. |
| **LTV** | **LTV (historical) = Sum of member_program_finances.final_total_price for all member_programs with program_status_id in (Active, Completed) for that lead_id.** Per-lead; no future projection. Report as average LTV = total such revenue / count of distinct lead_id with at least one such program. |
| **Revenue from existing clients %** | **Revenue from existing clients % (in period) = (Revenue in period from programs whose lead_id had at least one program with start_date before period start) / (Total revenue in period) × 100.** Revenue in period = sum of final_total_price for programs (Active+Completed) with start_date in period. “Existing” = lead’s min(start_date) < period start. |

---

**End of investigation document.**
