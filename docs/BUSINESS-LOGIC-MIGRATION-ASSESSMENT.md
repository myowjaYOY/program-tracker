# Business Logic Migration Assessment

**Date:** February 5, 2026  
**Purpose:** Identify frontend/API business logic to migrate to database layer  
**Goal:** Better isolation, security, and scalability

---

## Executive Summary

After a comprehensive code review, I identified **150+ pieces of business logic** currently in the frontend, API routes, and edge functions that should be moved to the database. This includes:

- **35+ calculation functions** (financial, survey scoring, analytics)
- **20+ validation rules** (business constraints, status transitions)
- **25+ data aggregations** (reports, dashboards, metrics)
- **15+ workflow operations** (multi-table transactions)
- **10+ data transformations** (complex joins, flattening)

**Critical Finding:** Financial calculations are scattered across 8+ files with potential inconsistencies. Tax calculations appear in at least 4 different places.

---

## Table of Contents

1. [Financial Calculations](#1-financial-calculations)
2. [Survey/Assessment Scoring](#2-surveyassessment-scoring)
3. [Validation Rules](#3-validation-rules)
4. [Workflow Operations](#4-workflow-operations)
5. [Report Aggregations](#5-report-aggregations)
6. [Data Transformations](#6-data-transformations)
7. [Status/State Management](#7-statusstate-management)
8. [Duplicate Logic Instances](#8-duplicate-logic-instances)
9. [Migration Priority Matrix](#9-migration-priority-matrix)
10. [Recommended Database Objects](#10-recommended-database-objects)

---

## 1. Financial Calculations

### Critical - Must Move to Database

| Logic | Current Location(s) | Why Move |
|-------|---------------------|----------|
| **Tax Calculation** | `financial-calculations.ts`, `program-financials-tab.tsx`, `program-info-tab.tsx`, `member-program-payment-form.tsx`, `sales-tax/route.ts` | Tax rate (8.25%) and proportional discount logic duplicated in 5+ places. Must be consistent for compliance. |
| **Program Price Calculation** | `financial-calculations.ts`, `useFinancialsDerived` hook, `finances/route.ts` | Formula: `totalCharge + taxes + max(financeCharges, 0) + discounts`. Scattered across files. |
| **Margin Calculation** | `financial-calculations.ts`, `add-program-item-form.tsx`, `executive-dashboard/route.ts` | Multiple margin formulas exist. Active programs use locked price, Quote uses projected. |
| **Variance Calculation** | `financial-calculations.ts`, `finances/route.ts` | `projectedPrice - lockedPrice`. Should trigger automatically when prices change. |
| **Total Cost/Charge Aggregation** | `items/route.ts`, `program-items-tab.tsx`, `add-program-item-form.tsx` | Sum of `item_cost * quantity` and `item_charge * quantity` calculated in 3+ places. |
| **Monthly Rate Calculation** | `member-programs/[id]/route.ts` (lines 312-314) | Membership monthly rate: `sum(item_charge * quantity)`. Critical for billing. |
| **Payment Amount Calculation** | `member-programs/[id]/route.ts` (line 393), `member-program-payment-form.tsx` | Payment distribution and adjustment logic in frontend. Dangerous for data integrity. |
| **Payment Auto-Adjustment** | `member-program-payment-form.tsx` (lines 173-262) | Complex redistribution when one payment changes. 60+ lines of frontend logic. |
| **Finance Charges Logic** | `financial-calculations.ts` | Negative = expense added to cost, Positive = revenue offset. Business rule in code. |
| **Template Totals** | `financial-calculations.ts`, `add-program-wizard.tsx` | Sum of template item costs/charges. |
| **PO Totals** | `create-po-modal.tsx` (lines 275-285) | Subtotal, tax, shipping, total. Should be database trigger. |
| **Contract Options** | `contract-options.ts` | 5% discount, 6% financing, 25% down, 5 months. Business rules in code. |

### Current Tax Calculation Code (Example of Duplication)

**Location 1:** `src/lib/utils/financial-calculations.ts`
```
calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts, taxRate = 0.0825)
```

**Location 2:** `src/app/api/sales-reports/sales-tax/route.ts`
```
discountRatio = discounts / totalCharge
salesTax = unitCharge * (1 - discountRatio) * 0.0825
```

**Location 3:** `src/components/programs/program-financials-tab.tsx`
```
totalTaxableCharge = items.filter(taxable).reduce(...)
```

**Location 4:** `src/components/forms/member-program-payment-form.tsx`
```
totalTaxableCharge = items.filter(taxable).reduce(...)  // Duplicate!
```

---

## 2. Survey/Assessment Scoring

### Critical - Core Business Logic

| Logic | Current Location | Why Move |
|-------|------------------|----------|
| **MSQ Answer Mapping** | `survey-scoring.ts` | Maps text ("Never", "Rarely", etc.) to numeric (0-4). |
| **MSQ Domain Categorization** | `survey-scoring.ts`, `msq-assessment.ts` | Keyword matching to assign questions to domains (head, eyes, digestive, etc.). |
| **MSQ Total Score** | `survey-scoring.ts`, `report-data-fetcher.ts` | Sum of all domain scores. |
| **MSQ Interpretation** | `survey-scoring.ts` | Score ranges → severity (optimal/mild/moderate/severe/very_severe). |
| **MSQ Improvement %** | `survey-scoring.ts` | `((baseline - current) / baseline) * 100`. |
| **MSQ Severity** | `msq-assessment.ts` | 0=none, ≤1.5=mild, ≤2.5=moderate, >2.5=severe. |
| **MSQ Trend Analysis** | `msq-assessment.ts`, `report-data-fetcher.ts` | Compares first vs last, detects fluctuation. |
| **MSQ Clinical Alerts** | `msq-assessment.ts` | Rule-based alerts (high toxic load, food sensitivity). |
| **MSQ Food Triggers** | `msq-assessment.ts` | Rule-based food trigger identification. |
| **PROMIS Answer Mapping** | `survey-scoring.ts` | Maps text to numeric (1-5). |
| **PROMIS Domain Categorization** | `survey-scoring.ts` | Keyword matching for 8 domains. |
| **PROMIS T-Score Conversion** | `survey-scoring.ts` | Lookup table: raw score (4-20) → T-score. |
| **PROMIS Severity Interpretation** | `promis-assessment.ts` | T-score thresholds differ for symptom vs function domains. |
| **PROMIS Clinical Significance** | `survey-scoring.ts` | Change thresholds: <5=none, <10=small, <15=moderate, ≥15=large. |
| **Week Number Calculation** | `survey-scoring.ts` | `Math.ceil(daysSinceStart / 7)`. |
| **Milestone Identification** | `survey-scoring.ts` | Baseline (0-2 weeks), Mid (5-7), End (11-13). |
| **Domain Score Calculation** | `process-survey-import/index.ts` | Aggregation and severity assignment. |

---

## 3. Validation Rules

### Critical - Security/Integrity

| Rule | Current Location | Why Move |
|------|------------------|----------|
| **Active Program Price Ceiling** | `financial-calculations.ts` | Cannot exceed contracted price. Validation in API. |
| **Active Program Margin Floor** | `financial-calculations.ts` | Cannot reduce below contracted margin. |
| **Status Transition Rules** | `member-programs/[id]/route.ts` (lines 172-237) | Quote→Active/Cancelled, Active→Paused/Cancelled/Completed. |
| **Membership Cannot Complete** | `member-programs/[id]/route.ts` (lines 203-222) | Business rule in API code. |
| **Payment Regeneration Block** | `finances/route.ts` (lines 231-251) | Block if any payment already paid. |
| **Item Quantity vs Used Count** | `add-program-item-form.tsx`, `items/[itemId]/route.ts` | Quantity cannot be less than used_count. |
| **Duplicate Lead Detection** | `leads/route.ts` (lines 98-117) | Case-insensitive name + email check. Should be unique constraint. |
| **Item Deletion Block** | `program-items-tab.tsx` (line 340-342) | Cannot delete items with used_count > 0. |
| **Active Program Item Bounds** | `items/route.ts`, `items/[itemId]/route.ts` | Price ceiling/margin floor checks before add/update. |
| **Payment Amount Validation** | `member-program-payment-form.tsx` | Total must equal program price. |
| **Finance Charges Range** | `validations/` | -999999.99 to 999999.99. Should be DB constraint. |
| **Discounts Must Be Negative** | `validations/` | Business rule should be DB constraint. |
| **Taxes Non-Negative** | `validations/` | Should be DB constraint. |

---

## 4. Workflow Operations

### Critical - Should Be Transactions

| Workflow | Current Location | Tables Affected | Why Move |
|----------|------------------|-----------------|----------|
| **Membership Activation** | `member-programs/[id]/route.ts` (lines 295-423) | member_programs, member_program_membership_finances, member_program_items, member_program_payments | 4 separate operations, not atomic. |
| **Add Program Item** | `items/route.ts` | member_program_items, member_program_item_tasks, member_programs, member_program_finances | 4 tables, should be transaction. |
| **Update/Delete Program Item** | `items/[itemId]/route.ts` | member_program_items, member_programs, member_program_finances | 3 tables, should be transaction. |
| **Schedule Date Change** | `schedule/[scheduleId]/route.ts` (lines 52-157) | member_program_item_schedule, member_program_items_task_schedule, cascade RPC | Complex cascade logic. |
| **Schedule Redemption** | `schedule/[scheduleId]/route.ts` (lines 159-273) | member_program_item_schedule, cascade adjustments | Side effects not atomic. |
| **Copy Tasks from Therapy** | `items/route.ts` (lines 168-203) | therapy_tasks → member_program_item_tasks | Should be trigger on item insert. |
| **Batch Payment Update** | `payments/batch-update/route.ts` | member_program_payments (loop) | Not atomic, should be single transaction. |
| **Program Unpause** | `member-programs/[id]/route.ts` (lines 425-454) | Triggers schedule regeneration | Side effect should be trigger. |
| **Finance Update + Payment Regen** | `finances/route.ts` | member_program_finances, member_program_payments | Should coordinate in transaction. |

---

## 5. Report Aggregations

### High Priority - Performance/Consistency

| Aggregation | Current Location | Why Move |
|-------------|------------------|----------|
| **Executive Dashboard Metrics** | `executive-dashboard/route.ts` | avgProgramValue, avgMargin, conversionRate, costPerCustomer, ROI. Complex joins in code. |
| **Monthly Sales Metrics** | `monthly-sales/route.ts` | Groups by month, tracks unique leads with Sets. 140+ lines of aggregation. |
| **Campaign Performance** | `campaign-performance/route.ts` | showRate, conversionRate, costPerLead. Audit event filtering. |
| **Inventory Forecast** | `inventory-forecast/route.ts` | dispensed_count, owed_count, cost calculations. Aggregation by therapy. |
| **Payment Metrics** | `payments/metrics/route.ts` | totalAmountOwed, totalAmountDue, totalAmountLate. Late payments by member. |
| **Dashboard Metrics** | `dashboard/metrics/route.ts` | progressPercentage calculation. |
| **Report Card Metrics** | `report-card/dashboard-metrics/route.ts` | avgSupportRating, worstMsqAverage, worstComplianceAverage. 700+ lines. |
| **Compliance Trends** | `analytics/compliance-trends/route.ts` | Fills missing months with nulls. |
| **Inventory Low Stock** | `inventory-management/metrics/route.ts` | quantity_on_hand < reorder_point filter. |
| **Lead Note Counts** | `leads/route.ts` | COUNT per lead, last follow-up note. |
| **Paid Payment Total** | `program-financials-tab.tsx` | Sum of paid payments. |
| **RASHA Group Summaries** | `member-program-rasha-tab.tsx`, `dashboard-program-rasha-tab.tsx` | Group by group_name, sum totalSeconds. |
| **Table Footer Aggregations** | `base-data-table.tsx` | sum, avg, min, max. Generic but should be DB. |
| **Compliance Average** | `ComplianceCard.tsx` | Average of nutrition, supplements, exercise, meditation. |
| **Analytics At-Risk Filter** | `InsightsTab.tsx` | Filters at-risk members by status. |

---

## 6. Data Transformations

### Medium Priority - Should Be Views

| Transformation | Current Location | Why Move |
|----------------|------------------|----------|
| **Programs List Flattening** | `member-programs/route.ts` | Flattens nested joins (user, lead, status, template). |
| **Leads List with Notes** | `leads/route.ts` | Joins leads + note counts + last follow-up. |
| **Payments List Flattening** | `payments/route.ts` | Flattens nested joins (status, method, program, lead). |
| **Schedule with Therapies** | `schedule/route.ts` | Joins schedule → items → therapies → types → users. |
| **Executive Dashboard Grouping** | `executive-dashboard/route.ts` | Builds leadToProgramsMap, groups campaign metrics. |
| **Monthly Sales Grouping** | `monthly-sales/route.ts` | Groups by month, processes campaigns/PMEs/programs separately. |
| **Report Card Mappings** | `report-card/dashboard-metrics/route.ts` | Maps sessions → leads, tasks → items → programs. |
| **Report Data Fetching** | `report-data-fetcher.ts` | Comprehensive MSQ/PROMIS data aggregation. |
| **Member Context** | `member-context-fetcher.ts` | Survey responses + provider notes. |

---

## 7. Status/State Management

### High Priority - Business Rules

| Logic | Current Location | Why Move |
|-------|------------------|----------|
| **Schedule Status Mapping** | `schedule-status.ts` | true='redeemed', false='missed', null='pending'. |
| **Schedule Status Cycle** | `schedule-status.ts` | pending→redeemed→missed→pending. |
| **Program Lock Rules** | `program-lock.ts` | Lock when status ≠ 'Quote'. |
| **Program Read-Only Rules** | `program-readonly.ts` | Completed, Cancelled, Lost = read-only. |
| **Valid Program Status Filter** | `program-status-service.ts` | Default = Active only, configurable exceptions. |
| **Payment Regeneration Decision** | `payments-rules.ts` | Regen if financing_type, finance_charges, or discounts changed. |
| **GHL Lead Creation Trigger** | `ghl-webhook.ts` | Stage name matching for lead creation. |
| **Margin Color Threshold** | `program-financials-tab.tsx` | green ≥80%, orange ≥75%, red <75%. |
| **Items Locked State** | `program-items-tab.tsx` | Membership after activation, read-only status. |
| **Payment Editability** | `member-program-payment-form.tsx` | Based on membership type, program status, payment status. |

---

## 8. Duplicate Logic Instances

### Must Consolidate

| Logic | Locations Found | Risk |
|-------|-----------------|------|
| **totalTaxableCharge Calculation** | `program-financials-tab.tsx`, `member-program-payment-form.tsx`, `program-info-tab.tsx`, `finances/route.ts` | 4 duplicate implementations. |
| **Tax Rate (8.25%)** | `financial-calculations.ts`, `sales-tax/route.ts`, `create-po-modal.tsx` | Hardcoded in 3+ places. |
| **MSQ Domain Categorization** | `survey-scoring.ts`, `msq-assessment.ts` | Different implementations. |
| **Trend Calculation** | `msq-assessment.ts`, `report-data-fetcher.ts`, `analyze-member-progress` | Similar logic in 3 places. |
| **Rating Text Mapping** | `process-feedback-alerts`, `report-card/dashboard-metrics/route.ts` | Support rating mapping duplicated. |
| **Date Parsing** | `process-survey-import`, `process-user-progress-import` | Excel date conversion in 2 places. |
| **Job Status Updates** | All import edge functions | Same pattern duplicated. |
| **Compliance Calculation** | `analyze-member-progress`, `ComplianceTab.tsx`, `ComplianceCard.tsx` | Similar aggregation logic. |

---

## 9. Migration Priority Matrix

### Priority 1: Critical (Security/Integrity)

| Item | Impact | Effort | Risk if Not Done |
|------|--------|--------|------------------|
| Financial calculations | High | Medium | Inconsistent pricing, tax errors |
| Multi-table transactions | High | Medium | Data corruption on failures |
| Status transition validation | High | Low | Invalid state changes |
| Active program constraints | High | Medium | Margin/price violations |
| Duplicate lead prevention | Medium | Low | Data quality issues |

### Priority 2: High (Performance/Consistency)

| Item | Impact | Effort | Risk if Not Done |
|------|--------|--------|------------------|
| Report aggregations | High | High | Slow dashboards, inconsistent metrics |
| Survey scoring | High | Medium | Inconsistent assessments |
| Payment calculations | High | Medium | Billing errors |
| Data transformation views | Medium | Medium | Maintenance burden |

### Priority 3: Medium (Maintainability)

| Item | Impact | Effort | Risk if Not Done |
|------|--------|--------|------------------|
| Status/state rules | Medium | Low | Scattered business rules |
| Workflow side effects | Medium | Medium | Manual coordination required |
| Validation schemas | Low | Low | Client-side only validation |

### Priority 4: Low (Nice to Have)

| Item | Impact | Effort | Risk if Not Done |
|------|--------|--------|------------------|
| UI aggregations | Low | Low | Minor performance impact |
| Formatting utilities | Low | Low | None |
| Template loading | Low | Low | None |

---

## 10. Recommended Database Objects

### New Functions to Create

| Function | Purpose | Replaces |
|----------|---------|----------|
| `calculate_program_price(program_id)` | Calculate total price including taxes, discounts, finance charges | `calculateProjectedPrice()`, `useFinancialsDerived` |
| `calculate_program_margin(program_id)` | Calculate margin percentage | `calculateProjectedMargin()` |
| `calculate_program_taxes(program_id)` | Calculate taxes on taxable items with discount proration | `calculateTaxesOnTaxableItems()` |
| `calculate_program_totals(program_id)` | Aggregate cost/charge from items | Multiple locations |
| `validate_active_program_change(program_id, new_price, new_margin)` | Enforce price ceiling and margin floor | `validateActiveProgramChanges()` |
| `activate_membership(program_id)` | Atomic membership activation workflow | 4 separate API operations |
| `add_program_item_with_tasks(program_id, item_data)` | Add item and copy tasks atomically | `items/route.ts` |
| `update_program_financials(program_id)` | Recalculate all financial fields | `updateMemberProgramCalculatedFields()` |
| `calculate_msq_scores(session_id)` | MSQ domain and total scoring | `calculateMsqScore()` |
| `calculate_promis_scores(session_id)` | PROMIS T-score conversion | `calculatePromisScore()` |
| `get_executive_dashboard_metrics(date_range)` | All executive dashboard calculations | `executive-dashboard/route.ts` |
| `get_monthly_sales_metrics(date_range)` | Monthly sales aggregations | `monthly-sales/route.ts` |
| `get_campaign_performance(campaign_id)` | Campaign metrics | `campaign-performance/route.ts` |
| `get_inventory_forecast()` | Inventory projections | `inventory-forecast/route.ts` |
| `get_payment_metrics()` | Payment aggregations | `payments/metrics/route.ts` |

### New Views to Create

| View | Purpose | Replaces |
|------|---------|----------|
| `vw_programs_list` | Programs with flattened joins | `member-programs/route.ts` GET |
| `vw_leads_with_notes` | Leads with note counts and last follow-up | `leads/route.ts` GET |
| `vw_payments_list` | Payments with flattened joins | `payments/route.ts` GET |
| `vw_schedule_details` | Schedule with therapy and type info | `schedule/route.ts` GET |
| `vw_program_financial_summary` | Program with calculated financials | Multiple components |
| `vw_member_compliance_summary` | Compliance percentages by member | `ComplianceCard.tsx` |
| `vw_rasha_group_summary` | RASHA items grouped with totals | `member-program-rasha-tab.tsx` |

### New Triggers to Create

| Trigger | Purpose | Replaces |
|---------|---------|----------|
| `tr_recalculate_program_totals` | On item insert/update/delete, recalc totals | `updateMemberProgramCalculatedFields()` |
| `tr_copy_therapy_tasks` | On item insert, copy tasks from therapy | `items/route.ts` task copying |
| `tr_validate_status_transition` | Enforce valid status transitions | `member-programs/[id]/route.ts` validation |
| `tr_lock_finances_on_activate` | Lock contracted values when activated | Already exists, verify coverage |
| `tr_validate_active_program_item` | Enforce bounds on Active program changes | `validateActiveProgramItemAddition()` |
| `tr_cascade_schedule_dates` | Update task dates when schedule changes | `schedule/[scheduleId]/route.ts` |
| `tr_regenerate_schedule_on_unpause` | Auto-regenerate when unpaused | `member-programs/[id]/route.ts` |

### New Constraints to Add

| Constraint | Table | Purpose |
|------------|-------|---------|
| `chk_discounts_negative` | member_program_finances | Discounts must be ≤ 0 |
| `chk_taxes_non_negative` | member_program_finances | Taxes must be ≥ 0 |
| `chk_quantity_gte_used` | member_program_items | Quantity ≥ used_count |
| `uq_lead_name_email` | leads | Prevent duplicates (LOWER(first_name), LOWER(last_name), LOWER(email)) |
| `chk_finance_charges_range` | member_program_finances | Between -999999.99 and 999999.99 |
| `chk_margin_range` | member_program_finances | Between -999.99 and 999.99 |

---

## Summary Statistics

| Category | Count | Priority |
|----------|-------|----------|
| Financial calculations | 15 | Critical |
| Survey scoring functions | 18 | High |
| Validation rules | 13 | Critical |
| Workflow operations | 9 | Critical |
| Report aggregations | 15 | High |
| Data transformations | 9 | Medium |
| Status/state rules | 10 | Medium |
| Duplicate logic instances | 8 | High (consolidate) |
| **Total items to migrate** | **97** | - |

### Effort Estimate

| Phase | Items | Estimated Complexity |
|-------|-------|---------------------|
| Phase 1: Critical validations & constraints | 15 | Low-Medium |
| Phase 2: Financial calculations | 15 | Medium |
| Phase 3: Workflow transactions | 9 | Medium-High |
| Phase 4: Report views & functions | 15 | High |
| Phase 5: Survey scoring | 18 | Medium |
| Phase 6: Data transformation views | 9 | Medium |
| Phase 7: Remaining business rules | 16 | Low-Medium |

---

## Next Steps

1. Review this assessment with development team
2. Prioritize based on business impact and current pain points
3. Create detailed migration plan for Phase 1
4. Set up testing framework to verify logic equivalence
5. Plan rollout with rollback capability

---

*This assessment is based on a comprehensive review of 50+ API routes, 50+ service/utility files, 20+ React components with business logic, and 4 edge functions.*
