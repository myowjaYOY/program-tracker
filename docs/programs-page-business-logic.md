## Programs Page – Business Logic Guide

### Scope

This document explains the end‑to‑end business logic that powers the Programs page: Program Info, Financials, Payments, Items, and Tasks tabs. It includes frontend behaviors, validation rules, API interactions, and SQL logic that is executed on the database.

## Entities and Key Fields

- **Member Programs** (`member_programs`) – core record; includes `total_cost`, `total_charge` and metadata.
- **Member Program Finances** (`member_program_finances`) – per‑program finance details:
  - `finance_charges` (number; may be positive or negative)
  - `discounts` (number; must be negative or 0)
  - `taxes` (number; non‑negative)
  - `final_total_price` (number ≥ 0)
  - `margin` (number, percent value)
  - `financing_type_id` (FK → `financing_types`)
- **Financing Types** (`financing_types`) – has `financing_source enum('internal','external')` and `financing_type_name` (e.g., “Financed - 3 Pay”).
- **Member Program Payments** (`member_program_payments`) – generated/updated based on Financials and rules below.

## Financials: Calculations and Rules

- **Program Price (display)**: `final_total_price = total_charge + finance_charges + discounts`
  - Note: Taxes are displayed separately and do not change `final_total_price`.
- **Margin (display)**: `margin = final_total_price > 0 ? ((final_total_price - total_cost) / final_total_price) * 100 : 0`
  - Color coding:
    - ≥ 80% → Green
    - ≥ 75% and < 80% → Orange
    - < 75% → Red

### Inputs and Formatting (Financials tab)

- `finance_charges` and `discounts` allow entering literal numbers or a percentage string (e.g., `10%`).
  - When a value ends with `%`, on blur it is converted to an absolute dollar amount using `total_charge` as the base.
  - `discounts` are forced negative after conversion.
- `taxes`: numeric only; cannot be negative.
- `financing_type_id`: optional selector.

### Validation (Zod – `member-program-finances.ts`)

- `member_program_id`: number (required when creating via API)
- `finance_charges`: number (optional; may be positive or negative)
- `discounts`: number (must be ≤ 0)
- `taxes`: number (must be ≥ 0)
- `final_total_price`: number (must be ≥ 0)
- `margin`: number (computed on the client and stored)
- `financing_type_id`: number (optional)

## Unified Save Flow (Financials tab)

Triggered by “Save Changes”.

1. Validate form.
2. Save Finances:
   - Create: POST `/api/member-programs/[id]/finances`
   - Update: PUT `/api/member-programs/[id]/finances`
   - Payload is sanitized to ensure numeric types are sent and `financing_type_id` is either a number or `undefined`.
3. Payments Update (automatic): After a successful save, payments are generated/updated when any of these are true:
   - No payments exist yet (new program)
   - Financing Type changed
   - Finance Charges changed
   - Discounts changed
   - Program Price changed due to Items changes (detected by comparing `program.total_charge` to the last saved charge inferred from finances)
4. UX
   - Save button shows a spinner; remains disabled during operation.
   - Success toasts: “Program finances updated successfully”, optionally followed by “Payments updated successfully”.
   - On any payments update error, finances remain saved and a non‑blocking error toast is shown.

### Unsaved Changes and Dirty State

- “Save Changes” is enabled only when there are material changes: financing type, finance charges, discounts, taxes, or program `total_charge` differs from the last saved state.
- Leaving the tab prompts a warning only when material changes are present.

### Items Impact Banner (Financials tab)

- A warning banner appears if `program.total_charge` (from Items) differs from the last saved charge inferred from finances:
  - `previous_program_charge = final_total_price - finance_charges - discounts`
  - If `round(program.total_charge)` ≠ `round(previous_program_charge)`, show: “Program Price changed because Items were updated. Saving will update payments accordingly.”
- The banner clears after a successful save and subsequent finances refetch brings both values in sync.

## Payments Generation and Update Logic (SQL)

Payments are managed by the SQL function below and invoked via POST `/api/member-programs/[id]/payments/regenerate` (RPC). The unified Financials save calls this endpoint when regeneration is required (see rules above).

### SQL Function: `regenerate_member_program_payments(p_program_id int)`

Key aspects (PL/pgSQL, `SECURITY DEFINER`):

- Pre‑checks and data:
  - Requires `auth.uid()` (caller must be authenticated).
  - Aborts if any existing payments for the program have `payment_date IS NOT NULL` (prevents altering paid schedules).
  - Deletes all existing payments for the program when safe to do so.
  - Reads finance data (`final_total_price`, `financing_type_id`) and joins to `financing_types` to get `financing_type_name` and `financing_source`.
  - Looks up `Pending` status id from `payment_status` using case‑insensitive match (`ILIKE 'pending'`).
- Exit if `final_total_price <= 0` (no payments generated).
- Generation rules:
  - External financing OR financing type name `ILIKE 'full payment'`: insert 1 payment due today (`current_date`) with `payment_amount = final_total_price`, `payment_status = Pending`, `payment_method_id = NULL`.
  - Internal financing: extract the first integer `N` found in `financing_type_name` (e.g., “Financed - 3 Pay” → 3). If not found/invalid, default to 1. Create `N` equal payments:
    - Amount per installment is truncated down to cents: `trunc(final_total_price / N, 2)`
    - Due dates are spaced by 30 days: `current_date + (i-1)*interval '30 days'`
    - Status `Pending`, method `NULL`.

### RLS and Permissions (required)

- Member Program Payments (`member_program_payments`):
  - SELECT/INSERT/DELETE policies constrained to the caller’s programs. DELETE policy allows only unpaid rows.
- Member Program Finances (`member_program_finances`):
  - SELECT policy constrained to the caller’s programs.
- Lookups:
  - `payment_status` and `financing_types`: read policies for authenticated users.
- Function grant:
  - `GRANT EXECUTE ON FUNCTION public.regenerate_member_program_payments(int) TO authenticated;`

## API Endpoints

- `GET /api/member-programs/[id]/finances` → returns a single finance record for the program.
- `POST /api/member-programs/[id]/finances` → create finance record; validates with Zod; injects `created_by/updated_by`.
- `PUT /api/member-programs/[id]/finances` → update finance record; validates with Zod; injects `updated_by`.
- `POST /api/member-programs/[id]/payments/regenerate` → calls the SQL function above.
- `GET /api/member-programs/[id]/payments` → lists payments (joined names for status/method).

## Payments Tab (read‑only)

- Displays payments with columns: Due Date (fixed date‑only rendering), Paid Date, Amount, Status, Method, Reference, Notes, Created/Updated.
- Date‑only rendering avoids timezone shifts by detecting `YYYY-MM-DD` and constructing a local date object.

## Remaining Balance (Financials)

- `remaining_balance = final_total_price − sum(payment_amount WHERE payment_date IS NOT NULL)`
- Updates whenever payments or Program Price change.

## Edge Cases and Behaviors

- If payments exist and some are paid: finances can still be saved; payments regeneration aborts with an error; existing payments are left unchanged and a non‑blocking error toast is displayed.
- Taxes changes do not trigger payments regeneration but are persisted on Save.
- If no payments exist: the first Save generates payments automatically based on the rules above.

## Developer Notes

- Query cache invalidation: after any create/update for finances or payments regeneration, React Query invalidates `memberProgramFinances`, `memberProgramKeys.detail`, and `memberProgramKeys.list` to refresh the UI.
- Avoid relying on component‑local baselines for cross‑tab change detection. Use the last saved finance values to infer previous Program Price.
