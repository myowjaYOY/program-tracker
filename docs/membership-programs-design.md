# Membership Programs - Design Document

**Date:** November 9, 2025  
**Last Updated:** November 22, 2025  
**Status:** Design Phase - Ready for Implementation (Revised)

---

## Overview

This document outlines the design for adding **Membership Programs** (recurring monthly billing) alongside existing **One-Time Programs** (fixed-term with upfront payment schedules).

### Key Differences: One-Time vs Membership

| Aspect | One-Time Program | Membership Program |
|--------|-----------------|-------------------|
| **Payment** | All payments scheduled upfront | Monthly recurring, generated each month |
| **Duration** | Fixed (e.g., 6 months) | Ongoing (month-to-month) |
| **Items** | Fixed set for entire program | Same items repeated each month |
| **End State** | Completed or Cancelled | Cancelled only (no "Completed") |
| **Commitment** | Term commitment | No term commitment |

### Design Principles

1. ✅ **Minimal changes** - Reuse 95% of existing infrastructure
2. ✅ **Backward compatible** - All existing programs continue working
3. ✅ **Maintain financial integrity** - Program totals must reflect reality (items accumulate)
4. ✅ **Simple workflow** - Automated monthly processing

---

## Database Schema Changes

### 1. MODIFY TABLE: `member_programs`

**Add these columns:**

```sql
ALTER TABLE member_programs
ADD COLUMN program_type TEXT CHECK (program_type IN ('one-time', 'membership')) NOT NULL DEFAULT 'one-time',
ADD COLUMN next_billing_date DATE;

CREATE INDEX idx_member_programs_type ON member_programs(program_type);
CREATE INDEX idx_member_programs_next_billing ON member_programs(next_billing_date) WHERE program_type = 'membership';

-- Set default for existing programs
UPDATE member_programs 
SET program_type = 'one-time' 
WHERE program_type IS NULL;
```

**New Columns:**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `program_type` | TEXT (check constraint) | No | 'one-time' or 'membership' |
| `next_billing_date` | DATE | Yes | When next payment/items are due (for memberships only) |

**Design Note:** Using TEXT with check constraint instead of FK to program_types table for simplicity. No lookup table needed.

**Existing Columns - Behavior Changes:**

| Column | One-Time Program | Membership Program |
|--------|-----------------|-------------------|
| `start_date` | Program start date | Membership start date |
| `duration` | Used (e.g., 180 days) | Blank and disabled in UI |
| `total_charge` | Fixed program price | Accumulates monthly (Month 1: $299, Month 10: $2,990) |
| `total_cost` | Fixed program cost | Accumulates monthly |
| `program_status_id` | All statuses valid | Quote, Active, Paused, Cancelled only (no Completed) |

---

### 2. NEW TABLE: `member_program_membership_finances`

**Purpose:** Store monthly locked values for membership billing (separate from cumulative totals)

```sql
CREATE TABLE member_program_membership_finances (
  membership_finance_id SERIAL PRIMARY KEY,
  member_program_id INTEGER UNIQUE NOT NULL REFERENCES member_programs(member_program_id) ON DELETE CASCADE,
  
  -- Monthly values (locked at activation)
  monthly_rate NUMERIC(10,2) NOT NULL,
  monthly_discount NUMERIC(10,2) DEFAULT 0,
  monthly_finance_charge NUMERIC(10,2) DEFAULT 0,
  
  -- Billing configuration (for future use)
  billing_frequency TEXT DEFAULT 'monthly' NOT NULL,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  
  CONSTRAINT fk_member_program FOREIGN KEY (member_program_id) 
    REFERENCES member_programs(member_program_id) ON DELETE CASCADE,
  CONSTRAINT check_billing_frequency CHECK (billing_frequency IN ('monthly', 'quarterly', 'annual'))
);

CREATE INDEX idx_membership_finances_program 
  ON member_program_membership_finances(member_program_id);
```

**Columns:**

| Column | Type | Purpose |
|--------|------|---------|
| `monthly_rate` | NUMERIC | Items total per period (locked at activation) |
| `monthly_discount` | NUMERIC | Discount per period (locked at activation) |
| `monthly_finance_charge` | NUMERIC | Finance charge per period (locked at activation) |
| `billing_frequency` | TEXT | 'monthly' (hard-coded for now, future: quarterly/annual) |

**Design Notes:**
- **Only exists for membership programs** - one-time programs don't have this table
- **Values locked at activation** - cannot change after program goes Active
- **Monthly values used for payment generation** - ensures consistent monthly billing
- **Separate from cumulative totals** in `member_program_finances`

---

### 3. MODIFY TABLE: `member_program_items`

**Add this column:**

```sql
ALTER TABLE member_program_items
ADD COLUMN billing_period_month INTEGER;

CREATE INDEX idx_program_items_billing_period 
ON member_program_items(member_program_id, billing_period_month);
```

**New Column:**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `billing_period_month` | INTEGER | Yes | Sequential counter (1, 2, 3...) indicating which billing cycle items belong to |

**Behavior:**
- **One-Time Programs:** `billing_period_month = NULL` (not used)
- **Memberships:** `billing_period_month = 1, 2, 3...` (tracks monthly item batches)

**Why billing_period_month?**
- Items accumulate each month (not a template) to maintain financial integrity
- Month 1: 4 coaching sessions (billing_period = 1)
- Month 2: Add 4 more coaching sessions (billing_period = 2)
- Month 10: 10 batches of 4 sessions each = 40 total sessions
- `total_charge` = sum of all items = accurate program price

**Example Data:**

```sql
-- One-Time Program (program_type_id = 1)
member_program_items:
  therapy_id: 5, quantity: 24, billing_period_month: NULL

-- Membership Program (program_type_id = 2)
-- Month 1:
  therapy_id: 5, quantity: 4, billing_period_month: 1
-- Month 2:
  therapy_id: 5, quantity: 4, billing_period_month: 2
-- Month 3:
  therapy_id: 5, quantity: 4, billing_period_month: 3
```

---

### 4. UNCHANGED TABLES

These tables work as-is for both program types:

- ✅ `member_program_finances` (stores cumulative totals for both types)
- ✅ `member_program_payments` (just more rows for memberships)
- ✅ `member_program_item_schedule`
- ✅ `member_program_item_tasks`
- ✅ `member_program_rasha`
- ✅ `program_status`
- ✅ `financing_types` (Memberships locked to "Full Pay")
- ✅ All other program-related tables

**Important:** `member_program_finances` stores **cumulative** values for memberships:
- `discounts` = Total lifetime discounts (Month 1: $50, Month 2: $100)
- `finance_charges` = Total lifetime finance charges (Month 1: $10, Month 2: $20)
- `final_total_price` = Current program price after all periods

---

## Business Logic & Workflows

### Monthly Processing Workflow (Memberships Only)

**Trigger:** Daily cron job

**Timing:** Generate 7 days before `next_billing_date` (allows time for review/adjustments)

**For each Active Membership where `next_billing_date - 7 days <= TODAY`:**

```typescript
async function processMonthlyBilling() {
  const memberships = await getActiveMemberships();
  
  for (const program of memberships) {
    const sevenDaysOut = new Date(program.next_billing_date);
    sevenDaysOut.setDate(sevenDaysOut.getDate() - 7);
    
    if (TODAY < sevenDaysOut) continue; // Too early
    
    // CHECK: Already generated?
    const paymentExists = await checkPaymentExists({
      program_id: program.id,
      due_date: program.next_billing_date
    });
    
    if (paymentExists) continue; // Skip, already done
    
    // Get locked monthly values
    const membershipFinances = await getMembershipFinances(program.id);
    const programFinances = await getFinances(program.id);
    
    // 1. Calculate next period
    const maxPeriod = await getMaxBillingPeriod(program.id);
    const nextPeriod = maxPeriod + 1;
    
    // 2. Clone Period 1 items → Period N
    await clonePeriod1ItemsToPeriodN(program.id, nextPeriod);
    
    // 3. Increment cumulative financial totals
    await updateFinances(program.id, {
      discounts: programFinances.discounts + membershipFinances.monthly_discount,
      finance_charges: programFinances.finance_charges + membershipFinances.monthly_finance_charge
    });
    // Note: total_charge/total_cost auto-update via database trigger
    
    // 4. Create payment using locked monthly values
    const monthlyPayment = 
      membershipFinances.monthly_rate - 
      membershipFinances.monthly_discount + 
      membershipFinances.monthly_finance_charge;
      
    await createPayment({
      program_id: program.id,
      amount: monthlyPayment, // Consistent every month!
      due_date: program.next_billing_date,
      status: 'pending',
      notes: `Month ${nextPeriod} membership payment`
    });
    
    // 5. Update next billing date
    await updateProgram(program.id, {
      next_billing_date: addMonths(program.start_date, nextPeriod)
    });
    
    // 6. Generate schedule for new period items
    await generateSchedule(program.id, nextPeriod);
  }
}
```

**Key Points:**
- ✅ **7-day advance** - Items/payments ready before due date
- ✅ **Idempotent** - Check if payment exists to prevent duplicates
- ✅ **Locked values** - Monthly payment stays consistent
- ✅ **Cumulative totals** - Discounts and finance charges increment each period
- ✅ **Anchor-based dates** - Always relative to original start_date

---

### Financial Accumulation Logic

**Critical Concept:** For memberships, discounts and finance charges **accumulate** each period to maintain consistent monthly payments and margins.

**Example: $299/month membership with $50 discount and $10 finance charge**

| Month | Items | Monthly Discount | Monthly Finance | Total Discounts | Total Finance | Program Price | Monthly Payment |
|-------|-------|-----------------|-----------------|-----------------|---------------|---------------|-----------------|
| 1 | $299 | -$50 | +$10 | -$50 | +$10 | $259 | $259 |
| 2 | $598 | -$50 | +$10 | -$100 | +$20 | $518 | $259 |
| 3 | $897 | -$50 | +$10 | -$150 | +$30 | $777 | $259 |
| 10 | $2,990 | -$50 | +$10 | -$500 | +$100 | $2,590 | $259 |

**Why This Works:**
- ✅ **Consistent monthly payment** - Customer always pays $259
- ✅ **Consistent margin** - Margin stays same each month
- ✅ **Accurate lifetime totals** - `total_charge` reflects all accumulated items
- ✅ **Accurate discounts/charges** - Cumulative values track total applied over lifetime

**Database Storage:**

```
member_program_membership_finances (LOCKED at activation):
  monthly_rate: $299
  monthly_discount: $50
  monthly_finance_charge: $10

member_program_finances (CUMULATIVE, grows each month):
  discounts: Month 1: $50 → Month 2: $100 → Month 3: $150
  finance_charges: Month 1: $10 → Month 2: $20 → Month 3: $30
  
member_programs (CUMULATIVE, auto-calculated):
  total_charge: Month 1: $299 → Month 2: $598 → Month 3: $897
  total_cost: Month 1: $111 → Month 2: $222 → Month 3: $333
```

---

### Payment Due Date Calculation

**Anchor-Based Billing (Recommended):**
- Payment due dates are ALWAYS based on original `start_date`
- Late payments don't shift future billing dates

```typescript
// Example: Started Jan 15
payment_1_due_date = Jan 15  (start_date)
payment_2_due_date = Feb 15  (start_date + 1 month)
payment_3_due_date = Mar 15  (start_date + 2 months)
// Even if Payment 1 was paid late on Jan 25
```

**Benefits:**
- Predictable billing (same day each month)
- Late payments don't cascade
- Easy to calculate "months active"

---

### Status Transitions

**One-Time Programs (unchanged):**
- Quote → Active → Paused → Completed/Cancelled

**Memberships (restricted):**
- Quote → Active → Paused → Cancelled
- **Cannot transition to "Completed"** (memberships don't "complete", they cancel)

**Status Change Effects:**

| From → To | Effect |
|-----------|--------|
| Quote → Active | Generate first payment + items |
| Active → Paused | Stop generating monthly items/payments |
| Paused → Active | Resume monthly generation |
| Active → Cancelled | Stop generation, set effective end date |

---

### Financial Calculations

**Program Price = SUM(items):**
```sql
-- This must ALWAYS be true:
member_programs.total_charge = SUM(item_charge × quantity) 
  FROM member_program_items 
  WHERE member_program_id = X

-- For Memberships:
-- Month 1: $299
-- Month 2: $299 + $299 = $598
-- Month 10: $299 × 10 = $2,990
```

**Payments Derive From Program Price:**
```sql
-- This must ALWAYS be true:
SUM(payment_amount) FROM member_program_payments = member_programs.total_charge
```

**Margin Calculation (unchanged):**
```sql
margin = ((total_charge - total_cost) / total_charge) × 100
```

---

## Program Creation Workflow

### Create Program Flow (Both Types)

**Step 1: Basic Information**
- **Program Type:** Select "One-Time Program" or "Membership"
  - Can be chosen anytime during creation
  - **Cannot be changed** after program is created
  - No conversion between types allowed

**Step 2: Configure Fields**

**For One-Time Programs:**
- Duration: Enter days (e.g., 180)
- Financing Type: All options available
- Status: All transitions available

**For Memberships:**
- Duration: **Blank and disabled** (not used)
- Financing Type: **Locked to "Full Pay"** (disabled, cannot change)
- Status: Quote, Active, Paused, Cancelled (no "Completed" option)

**Step 3: Add Items (Quote Stage)**
- Same workflow for both types
- Add items from templates or manually
- Items can be edited freely while in Quote status
- For memberships: These items become "Period 1 template"

**Step 4: Configure Financials**
- Discounts, finance charges, taxes work the same
- Label changes:
  - One-Time: "Program Price: $X"
  - Membership: "Monthly Rate: $X"

**Step 5: Activation (Quote → Active)**

**For One-Time Programs (unchanged):**
1. Standard validation
2. Generate schedule
3. Status = Active

**For Memberships (NEW logic):**
1. Validate required fields
2. Validate `financing_type = 'Full Pay'`
3. Calculate monthly values from Period 1 items
4. **Create membership_finances record:**
   - monthly_rate = sum of Period 1 items
   - monthly_discount = current discounts
   - monthly_finance_charge = current finance charges
   - billing_frequency = 'monthly'
5. **Lock items:** Mark all items as `billing_period_month = 1` (READ-ONLY)
6. **Create first payment:**
   - amount = monthly_rate - monthly_discount + monthly_finance_charge
   - due_date = start_date
7. Set `next_billing_date = start_date + 1 month`
8. Generate schedule
9. Status = Active

**Important Rules:**
- ✅ Both types must start as Quote (cannot create directly as Active)
- ✅ Templates work the same for both types
- ✅ Validation same as current (can save without items if allowed now)
- ❌ **Memberships: Items LOCKED after activation** (cannot edit Period 1)
- ❌ One-Time: Items still editable after activation (no change)

---

## UI Changes Summary

### 1. Programs Grid (Main List)

**Add:**
- "Type" column with badge (🔵 Program / 🟢 Membership)
- Filter dropdown: "All", "One-Time Programs", "Memberships"

---

### 2. Program Form (Create/Edit)

**Add at top:**
- "Program Type" dropdown (One-Time Program, Membership)

**Conditional display:**
- If One-Time: Show "Duration (days)"
- If Membership: Show "Billing Frequency" (Monthly, Quarterly, Annual), hide Duration

---

### 3. Program Info Tab

**Add fields:**
- "Program Type" dropdown - Prominent placement (One-Time Program / Membership)
  - Editable during creation
  - **Read-only after creation** (cannot convert types)
  - Locked/disabled once program is created
- "Duration" field behavior:
  - One-Time: Normal input (e.g., "180 days")
  - Membership: **Blank and disabled** (not used)
- "Next Billing Date" (Memberships only, read-only, system-managed)

**Status dropdown changes:**
- Memberships: Remove "Completed" option (can only be Cancelled)
- One-Time: Keep all statuses

**Financing Type:**
- One-Time: All financing types available
- Membership: **Locked to "Full Pay"** (disabled dropdown, visible but not editable)

**Note:** Billing frequency is NOT shown in UI (hard-coded to 'monthly' in backend for now)

---

### 4. Financials Tab

**Label Changes:**
- One-Time: "Program Price: $12,467.50"
- Membership: "Monthly Rate: $299.00" ← Changed label

**For One-Time Programs:**
- No changes (current display)

**For Memberships - Two Sections:**

**Section 1: Current Period (from member_program_membership_finances)**
```
Monthly Rate: $299.00
Monthly Discount: -$50.00
Monthly Finance Charge: +$10.00
Monthly Cost: $111.00
─────────────────────────
Monthly Payment: $259.00
Monthly Margin: 63%
```

**Section 2: Lifetime Totals (from member_program_finances)**
```
Billing Periods: 10 months
Member Since: Nov 18, 2025

Total Revenue: $2,990.00
Total Discounts: -$500.00
Total Finance Charges: +$100.00
Total Cost: $1,110.00
─────────────────────────
Total Payments: $2,590.00
Lifetime Margin: 63%
```

**Data Sources:**
- Monthly values: `member_program_membership_finances` (locked at activation)
- Lifetime totals: `member_program_finances` + `member_programs` (cumulative)

---

### 5. Items Tab

**For One-Time Programs:**
- No changes (editable at all times in Quote and Active status)

**For Memberships:**

**Quote Stage:**
- ✅ Items fully editable (add/edit/delete)
- Normal behavior

**Active Stage (AFTER ACTIVATION):**
- ❌ **Period 1 items LOCKED** (read-only, cannot edit)
- ✅ Can view all items
- 🔒 Show lock icon or banner: "Items cannot be edited after activation for membership programs"
- Historical periods (2, 3, 4...) also read-only

**Add filter dropdown:**
- "View Billing Period"
  - Current Period (default)
  - All History
  - Period 1, Period 2, ... Period N

**Display changes:**
- Show "Billing Period" column when viewing All History
- Period 1: Read-only after activation
- Period 2+: Always read-only (auto-generated)

**No "Add Item" button for Active memberships** (items locked)

---

### 6. Payments Tab

**For Memberships:**

**Quote Stage:**
- Show info message: "ℹ️ Payments will be generated monthly after activation"
- No payments displayed yet

**Active Stage:**

**Add:**
- "Billing Period" column (Month 1, Month 2, etc.)
- Summary section at top:
  - Payment Status
  - Next Payment Due
  - Total Paid to Date
  - Outstanding Balance

**Visual grouping:**
- Paid (collapsed)
- Upcoming (expanded)
- Overdue (highlighted red)

---

### 7. Tasks Tab

**For Memberships:**
- Add "Billing Period" filter (default: current period)

---

### 8. Script Tab

**For Memberships:**
- Add "Billing Period" filter
- Show note: "Showing schedule for Month N ([date range])"

---

### 9. To Do Tab & RASHA Tab

**No changes needed** - work for both types

---

## Implementation Checklist

### Phase 1: Database
- [ ] Add columns to `member_programs` (program_type, next_billing_date)
- [ ] Add check constraint for program_type
- [ ] Create `member_program_membership_finances` table
- [ ] Add column to `member_program_items` (billing_period_month)
- [ ] Create indexes
- [ ] Run data migration (set existing programs to 'one-time')
- [ ] Test database changes

### Phase 2: Backend API
- [ ] Update validation schemas (zod) - add program_type enum
- [ ] Update TypeScript types (database.types.ts)
- [ ] Create `use-membership-finances` hook
- [ ] Update `use-member-programs` hooks
- [ ] Create API routes for membership finances
- [ ] Create monthly processing function (7-day advance)
- [ ] Add cron job for monthly generation
- [ ] Create activation logic for memberships
- [ ] Test API changes

### Phase 3: UI Components
- [ ] Update Program Info Tab:
  - [ ] Add Program Type dropdown (prominent)
  - [ ] Duration field: blank/disabled for memberships
  - [ ] Financing Type: locked to "Full Pay" for memberships
  - [ ] Status dropdown: remove "Completed" for memberships
  - [ ] Add conditional rendering logic
- [ ] Update Financials Tab:
  - [ ] Change label: "Monthly Rate" for memberships
  - [ ] Add Current Period section (monthly values)
  - [ ] Add Lifetime Totals section (cumulative values)
  - [ ] Fetch membership_finances data
- [ ] Update Items Tab:
  - [ ] Add billing period filter dropdown
  - [ ] Lock items after activation (memberships only)
  - [ ] Show lock icon/banner for active memberships
  - [ ] Hide "Add Item" button for active memberships
- [ ] Update Payments Tab:
  - [ ] Add message in Quote stage: "Payments will be generated monthly after activation"
  - [ ] Add billing period column
  - [ ] Add payment summary section
- [ ] Update Programs Grid (type column/filter)
- [ ] Create Billing Period Filter component (reusable)
- [ ] Test UI changes

### Phase 4: Business Logic
- [ ] Implement activation logic:
  - [ ] Calculate and lock monthly values
  - [ ] Create membership_finances record
  - [ ] Set next_billing_date
  - [ ] Create first payment
  - [ ] Lock Period 1 items
- [ ] Implement monthly processing:
  - [ ] 7-day advance check
  - [ ] Payment existence check (idempotency)
  - [ ] Clone Period 1 items → Period N
  - [ ] Increment cumulative discounts/finance charges
  - [ ] Generate payment using locked monthly values
  - [ ] Update next_billing_date
  - [ ] Generate schedule for new period
- [ ] Implement status transition rules
- [ ] Implement item locking for active memberships
- [ ] Test workflows end-to-end
- [ ] Handle edge cases (paused memberships, late payments)

### Phase 5: Testing & Deployment
- [ ] Create test memberships
- [ ] Verify financial calculations
- [ ] Test monthly generation
- [ ] Test all status transitions
- [ ] Document admin procedures
- [ ] Deploy to production

---

## Key Design Changes from Original (Nov 22, 2025)

### Simplified Schema
- ❌ **Removed:** `program_types` lookup table
- ✅ **Added:** Simple TEXT field with check constraint
- ✅ **Reason:** Simpler, no need for foreign key joins

### Separate Finances Table
- ✅ **Added:** `member_program_membership_finances` table
- ✅ **Purpose:** Store locked monthly values separately from cumulative totals
- ✅ **Benefit:** Clean separation, no NULL columns for one-time programs

### Financial Accumulation
- ✅ **Discounts accumulate:** Each period adds monthly_discount to cumulative total
- ✅ **Finance charges accumulate:** Each period adds monthly_finance_charge to cumulative total
- ✅ **Result:** Consistent monthly payment while lifetime totals grow accurately

### Item Locking
- ✅ **Quote stage:** Items editable (both types)
- ❌ **Active memberships:** Period 1 items LOCKED (cannot edit)
- ✅ **Active one-time:** Items still editable (no change)
- ✅ **Reason:** Maintain consistency of monthly template

### Billing Frequency
- ✅ **Field exists:** In membership_finances table
- ❌ **Not shown in UI:** Hard-coded to 'monthly' for now
- ✅ **Future-proof:** Can expose UI control later without schema changes

### Duration Field
- ✅ **One-time:** Normal input
- ❌ **Membership:** Blank and disabled (not used)
- ✅ **Reason:** Memberships are month-to-month, no fixed duration

### Financing Type
- ✅ **One-time:** All options available
- ❌ **Membership:** Locked to "Full Pay" (disabled dropdown)
- ✅ **Reason:** Monthly billing incompatible with payment plans

### Monthly Job Timing
- ✅ **Generate:** 7 days before next_billing_date
- ✅ **Idempotency:** Check if payment exists before generating
- ✅ **Reason:** Time for review, prevent duplicates

---

## Edge Cases & Considerations

### Paused Memberships
- When paused: Stop generating items/payments
- When resumed: Resume from next scheduled period
- `next_billing_date` doesn't advance while paused

### Late Payments
- Payments stay "Due" until paid
- Next payment still generates on schedule
- Can have multiple outstanding payments
- Business decision: Auto-pause after X missed payments?

### Manual Corrections
- If items missed: Manually add with correct `billing_period_month`
- If payment missed: Manually create with correct period label

### Cancellation
- Set status to "Cancelled"
- Stop generating items/payments
- `updated_at` = effective cancellation date
- Historical data preserved

### Mid-Period Changes
- Memberships are "set and forget"
- Changes require creating new program
- Original program cancelled, new program created

---

## Questions for Future Discussion

1. **Failed Payments:** Auto-pause policy? Grace period?
2. **Proration:** Do we ever need to prorate first/last month?
3. **Upgrades/Downgrades:** New program or modify existing?
4. **Annual Memberships:** Generate 12 months at once or still monthly?
5. **Trial Periods:** Need a third program type?
6. **Contracts:** Do memberships have minimum commitment periods?
7. **Auto-renewal:** Explicit opt-in or default behavior?

---

## References

- Current program model: `src/app/dashboard/programs/page.tsx`
- Financial calculations: `src/lib/hooks/use-financials-derived.ts`
- Payment processing: `src/components/programs/program-payments-tab.tsx`
- Status transitions: `src/components/programs/program-info-tab.tsx`

---

## Revision History

### November 22, 2025 - Major Revisions
- **Simplified schema:** Removed program_types table, use check constraint
- **Added:** `member_program_membership_finances` table for locked monthly values
- **Clarified:** Financial accumulation logic (discounts/charges increment each period)
- **Clarified:** Item locking behavior (Period 1 locked after activation for memberships)
- **Added:** Program creation workflow documentation
- **Clarified:** Billing frequency hard-coded to 'monthly', not exposed in UI
- **Clarified:** Duration field blank/disabled for memberships
- **Clarified:** Financing type locked to "Full Pay" for memberships
- **Clarified:** Monthly job runs 7 days before next_billing_date
- **Added:** Idempotency check (payment existence before generation)

### November 9, 2025 - Initial Design
- Original design document created
- Database schema proposed
- UI changes outlined
- Implementation checklist created

---

## Detailed Implementation Plan

This section provides a step-by-step implementation guide organized into phases. Each phase builds on the previous one and includes verification checkpoints before proceeding.

---

### Pre-Implementation Preparation

**Duration:** 1 day

#### Step 1: Review Current State
1. Review all existing program-related tables in the database schema
2. Review current `member_programs`, `member_program_finances`, `member_program_items`, and `member_program_payments` table structures
3. Document all existing columns, constraints, and relationships
4. Identify all views that reference these tables
5. Identify all database triggers that affect these tables

#### Step 2: Review Existing Code
1. List all API routes under `/api/programs/`
2. List all React Query hooks related to programs (`use-member-programs`, `use-financials-derived`, etc.)
3. List all UI components that display or edit programs
4. Document the current program creation and activation flow
5. Document the current financial calculation logic

#### Step 3: Create Backup Strategy
1. Document rollback plan for database changes
2. Identify critical data that needs protection
3. Plan testing approach for each phase

#### Checkpoint: Have complete inventory of all files and tables that will be affected

---

### Phase 1: Database Schema Changes

**Duration:** 2-3 days  
**Dependencies:** None  
**Risk Level:** Low (additive changes only)

#### Step 1.1: Add Columns to member_programs Table
1. Create migration file for adding `program_type` column
   - Column type: TEXT with NOT NULL constraint
   - Default value: 'one-time'
   - Add CHECK constraint limiting values to ('one-time', 'membership')
2. Create migration file for adding `next_billing_date` column
   - Column type: DATE
   - Nullable (only used for memberships)
3. Run migrations in development environment
4. Verify columns exist with correct constraints

#### Step 1.2: Create Indexes for member_programs
1. Create index on `program_type` column for filtering
2. Create partial index on `next_billing_date` for membership programs only (WHERE program_type = 'membership')
3. Run index creation
4. Verify indexes exist and are being used by query planner

#### Step 1.3: Backfill Existing Data
1. Update all existing programs to set `program_type = 'one-time'`
2. Verify all existing programs have program_type set
3. Verify no NULL values remain in program_type column

#### Step 1.4: Create member_program_membership_finances Table
1. Create migration file for new table with columns:
   - `membership_finance_id` (SERIAL PRIMARY KEY)
   - `member_program_id` (INTEGER, UNIQUE, NOT NULL, FK to member_programs)
   - `monthly_rate` (NUMERIC 10,2, NOT NULL)
   - `monthly_discount` (NUMERIC 10,2, DEFAULT 0)
   - `monthly_finance_charge` (NUMERIC 10,2, DEFAULT 0)
   - `billing_frequency` (TEXT, DEFAULT 'monthly', NOT NULL)
   - `created_at`, `created_by`, `updated_at`, `updated_by` (audit fields)
2. Add CHECK constraint on billing_frequency ('monthly', 'quarterly', 'annual')
3. Add ON DELETE CASCADE for member_program_id foreign key
4. Create index on member_program_id
5. Run migration
6. Verify table created with all constraints

#### Step 1.5: Add Column to member_program_items Table
1. Create migration file for adding `billing_period_month` column
   - Column type: INTEGER
   - Nullable (NULL for one-time programs)
2. Create composite index on (member_program_id, billing_period_month)
3. Run migration
4. Verify column exists
5. Verify existing items have NULL for billing_period_month (expected for one-time programs)

#### Step 1.6: Update TypeScript Database Types
1. Regenerate database types using Supabase CLI
2. Verify new columns appear in `Database` type definitions
3. Verify new table `member_program_membership_finances` has type definition
4. Update any manual type extensions if needed

#### Phase 1 Checkpoint
- [ ] All migrations applied successfully
- [ ] All existing programs have `program_type = 'one-time'`
- [ ] New `member_program_membership_finances` table exists
- [ ] All indexes created
- [ ] TypeScript types regenerated and include new schema
- [ ] Existing application functionality unchanged (regression test)

---

### Phase 2: Backend Validation & Types

**Duration:** 1-2 days  
**Dependencies:** Phase 1 complete  
**Risk Level:** Low

#### Step 2.1: Update Zod Validation Schemas
1. Open `src/lib/validations/` directory
2. Add `program_type` field to program schema
   - Enum with values: 'one-time', 'membership'
   - Default: 'one-time'
3. Add `next_billing_date` field to program schema
   - Optional date field
   - Only required when program_type = 'membership' and status = 'Active'
4. Create new validation schema for `membership_finances`
   - Required fields: monthly_rate
   - Optional fields: monthly_discount, monthly_finance_charge, billing_frequency
5. Add `billing_period_month` field to program items schema
   - Optional integer field

#### Step 2.2: Update TypeScript Interfaces
1. Update `MemberProgram` interface in types/common.ts or relevant file
2. Add `program_type: 'one-time' | 'membership'`
3. Add `next_billing_date: string | null`
4. Create new `MembershipFinances` interface
5. Update `MemberProgramItem` interface to include `billing_period_month`

#### Step 2.3: Create Validation Rules
1. Define rule: If program_type = 'membership', financing_type must be 'Full Pay'
2. Define rule: If program_type = 'membership', status cannot be 'Completed'
3. Define rule: If program_type = 'membership' and status = 'Active', next_billing_date required
4. Define rule: program_type cannot change after program creation

#### Phase 2 Checkpoint
- [ ] All Zod schemas updated
- [ ] All TypeScript interfaces updated
- [ ] Validation rules documented and ready for implementation
- [ ] No TypeScript compilation errors

---

### Phase 3: API Routes - Read Operations

**Duration:** 2 days  
**Dependencies:** Phase 2 complete  
**Risk Level:** Low

#### Step 3.1: Update Program List API
1. Open `/api/programs/route.ts` (GET handler)
2. Include `program_type` and `next_billing_date` in SELECT query
3. Add optional query parameter for filtering by program_type
4. Test: Verify all programs return with program_type field
5. Test: Verify filtering by program_type works

#### Step 3.2: Update Program Detail API
1. Open `/api/programs/[id]/route.ts` (GET handler)
2. Include `program_type` and `next_billing_date` in SELECT query
3. Test: Verify single program returns with new fields

#### Step 3.3: Create Membership Finances API - Read
1. Create new route: `/api/programs/[id]/membership-finances/route.ts`
2. Implement GET handler to fetch membership finances for a program
3. Return 404 if program is not a membership
4. Return membership finances record if exists
5. Test: Verify returns data for membership programs
6. Test: Verify returns 404 for one-time programs

#### Step 3.4: Update Program Items API
1. Open `/api/programs/[id]/items/route.ts` (GET handler)
2. Include `billing_period_month` in SELECT query
3. Add optional query parameter for filtering by billing_period_month
4. Test: Verify items return with billing_period_month field
5. Test: Verify filtering by billing period works

#### Phase 3 Checkpoint
- [ ] All GET endpoints return new fields
- [ ] Filtering works correctly
- [ ] Membership finances endpoint functional
- [ ] Existing functionality unchanged

---

### Phase 4: API Routes - Write Operations

**Duration:** 3-4 days  
**Dependencies:** Phase 3 complete  
**Risk Level:** Medium

#### Step 4.1: Update Program Creation API
1. Open `/api/programs/route.ts` (POST handler)
2. Accept `program_type` in request body
3. Validate program_type is 'one-time' or 'membership'
4. If membership: Validate financing_type is 'Full Pay' (or set it automatically)
5. If membership: Set duration to NULL or ignore any provided value
6. Save program with program_type
7. Test: Create one-time program - verify works as before
8. Test: Create membership program - verify program_type saved correctly
9. Test: Create membership with non-Full Pay financing - verify rejected

#### Step 4.2: Update Program Update API
1. Open `/api/programs/[id]/route.ts` (PATCH/PUT handler)
2. Prevent changing program_type after creation (return error if attempted)
3. If membership: Prevent changing financing_type from 'Full Pay'
4. If membership: Prevent setting status to 'Completed'
5. Test: Attempt to change program_type - verify rejected
6. Test: Attempt to complete membership - verify rejected

#### Step 4.3: Create Membership Finances API - Write
1. Open `/api/programs/[id]/membership-finances/route.ts`
2. Implement POST handler to create membership finances record
   - Only allow for membership programs
   - Only allow when program status is transitioning to Active
   - Calculate monthly_rate from Period 1 items if not provided
3. Implement PATCH handler to update (restricted after activation)
4. Test: Create membership finances - verify saved correctly
5. Test: Attempt to modify after activation - verify restricted

#### Step 4.4: Update Program Items API - Write
1. Open `/api/programs/[id]/items/route.ts` (POST handler)
2. If membership and status = Active: Reject new items (items locked)
3. If membership and status = Quote: Accept items, set billing_period_month = NULL initially
4. Update PUT/PATCH handler with same logic
5. Update DELETE handler: If membership and status = Active, reject
6. Test: Add items to Quote membership - verify works
7. Test: Add items to Active membership - verify rejected
8. Test: Edit items on Active membership - verify rejected

#### Step 4.5: Implement Activation Logic for Memberships
1. Create new service function: `activateMembershipProgram(programId)`
2. Logic flow:
   - Verify program is a membership
   - Verify program is in Quote status
   - Verify financing_type is Full Pay
   - Calculate monthly_rate from current items (sum of item_charge × quantity)
   - Get current discounts and finance charges from program_finances
   - Create membership_finances record with locked values
   - Update all current items to set billing_period_month = 1
   - Calculate first payment amount: monthly_rate - monthly_discount + monthly_finance_charge
   - Create first payment record with due_date = start_date
   - Set next_billing_date = start_date + 1 month
   - Update program status to Active
3. Wrap entire operation in database transaction
4. Test: Activate membership with items - verify all steps complete
5. Test: Activate membership without items - verify behavior (accept or reject per business rule)
6. Test: Activate one-time program - verify uses existing logic unchanged

#### Step 4.6: Update Status Transition API
1. Locate status transition logic (likely in program update or dedicated endpoint)
2. Add special handling for membership activation (call activateMembershipProgram)
3. Add restriction: Memberships cannot transition to Completed status
4. Add handling for Pause: When membership paused, no additional action needed (next_billing_date stays)
5. Add handling for Cancel: When membership cancelled, no additional action needed
6. Test: All status transitions for memberships
7. Test: Verify one-time programs unchanged

#### Phase 4 Checkpoint
- [ ] Program creation works for both types
- [ ] Program type immutable after creation
- [ ] Membership financing locked to Full Pay
- [ ] Membership status cannot be Completed
- [ ] Items locked after membership activation
- [ ] Activation creates membership_finances record
- [ ] Activation creates first payment
- [ ] Activation sets next_billing_date
- [ ] All items marked as billing_period_month = 1 after activation
- [ ] One-time programs completely unchanged

---

### Phase 5: React Query Hooks

**Duration:** 2 days  
**Dependencies:** Phase 4 complete  
**Risk Level:** Low

#### Step 5.1: Update Existing Program Hooks
1. Open `src/lib/hooks/use-member-programs.ts`
2. Update type definitions to include new fields
3. Verify query returns new fields (program_type, next_billing_date)
4. Add filtering capability by program_type if needed

#### Step 5.2: Create Membership Finances Hook
1. Create new file: `src/lib/hooks/use-membership-finances.ts`
2. Implement `useMembershipFinances(programId)` query hook
   - Fetch from `/api/programs/[id]/membership-finances`
   - Only enabled when program is a membership
3. Implement `useCreateMembershipFinances()` mutation hook
4. Implement `useUpdateMembershipFinances()` mutation hook
5. Add proper cache invalidation
6. Add toast notifications for success/error

#### Step 5.3: Update Program Items Hook
1. Open `src/lib/hooks/use-program-items.ts` (or equivalent)
2. Add filtering parameter for billing_period_month
3. Update type to include billing_period_month field

#### Step 5.4: Update Financial Calculations Hook
1. Open `src/lib/hooks/use-financials-derived.ts`
2. Add logic to handle membership-specific calculations
3. For memberships: Calculate monthly payment from membership_finances
4. For memberships: Calculate lifetime totals from program_finances
5. Ensure existing one-time calculations unchanged

#### Step 5.5: Create Activation Hook
1. Create or update hook for program activation
2. Add `useActivateMembershipProgram()` mutation
3. Handle success: Invalidate program queries, membership finances queries
4. Handle error: Display appropriate toast message

#### Phase 5 Checkpoint
- [ ] All hooks return new fields
- [ ] Membership finances hook functional
- [ ] Financial calculations correct for both types
- [ ] Cache invalidation working properly
- [ ] Toast notifications appropriate

---

### Phase 6: UI Components - Program Info Tab

**Duration:** 2-3 days  
**Dependencies:** Phase 5 complete  
**Risk Level:** Medium

#### Step 6.1: Add Program Type Dropdown
1. Open `src/components/programs/program-info-tab.tsx`
2. Add "Program Type" dropdown field at prominent position (near top)
3. Options: "One-Time Program", "Membership"
4. Styling: Make visually prominent (perhaps with icon badge)
5. Behavior during creation:
   - Editable dropdown
   - Default to "One-Time Program"
6. Behavior after creation:
   - Read-only/disabled
   - Show lock icon or "Cannot be changed" tooltip
7. Test: Create new program - verify dropdown works
8. Test: Edit existing program - verify dropdown disabled

#### Step 6.2: Implement Conditional Duration Field
1. Locate Duration field in the form
2. Add conditional logic:
   - If program_type = 'one-time': Show normal duration input
   - If program_type = 'membership': Show field as disabled/blank with helper text "Not applicable for memberships"
3. Clear duration value when switching to membership (during creation)
4. Test: Switch to membership - verify duration disabled
5. Test: Switch to one-time - verify duration enabled

#### Step 6.3: Implement Conditional Financing Type
1. Locate Financing Type dropdown in the form
2. Add conditional logic:
   - If program_type = 'one-time': All financing options available
   - If program_type = 'membership': Lock to "Full Pay", show as disabled
3. Auto-set to Full Pay when switching to membership (during creation)
4. Test: Switch to membership - verify financing locked to Full Pay
5. Test: Switch to one-time - verify all financing options available

#### Step 6.4: Implement Conditional Status Options
1. Locate Status dropdown in the form
2. Add conditional logic:
   - If program_type = 'one-time': All status options available
   - If program_type = 'membership': Remove "Completed" from options
3. Test: Open membership - verify Completed not in dropdown
4. Test: Open one-time - verify Completed available

#### Step 6.5: Add Next Billing Date Display (Memberships Only)
1. Add "Next Billing Date" field for memberships
2. Display only when:
   - program_type = 'membership'
   - status = 'Active' or 'Paused'
3. Make field read-only (system-managed)
4. Format as readable date
5. Test: View active membership - verify next billing date shows
6. Test: View one-time program - verify field not visible

#### Step 6.6: Add Visual Indicators
1. Add badge/chip next to program name showing type (e.g., 🔵 Program / 🟢 Membership)
2. Consider color-coding or icon to differentiate at a glance
3. Test: Visual distinction clear between types

#### Phase 6 Checkpoint
- [ ] Program Type dropdown works correctly
- [ ] Duration field conditional behavior correct
- [ ] Financing Type locked for memberships
- [ ] Status options filtered for memberships
- [ ] Next Billing Date displays for active memberships
- [ ] Visual indicators clear
- [ ] All existing one-time program functionality unchanged

---

### Phase 7: UI Components - Financials Tab

**Duration:** 2-3 days  
**Dependencies:** Phase 6 complete  
**Risk Level:** Medium

#### Step 7.1: Update Labels for Memberships
1. Open `src/components/programs/program-financials-tab.tsx`
2. Add conditional label logic:
   - One-time: "Program Price: $X"
   - Membership: "Monthly Rate: $X"
3. Apply to main price display
4. Test: View membership - verify "Monthly Rate" label
5. Test: View one-time - verify "Program Price" label

#### Step 7.2: Create Monthly Summary Section (Memberships Only)
1. Add new section: "Current Period" (only visible for memberships)
2. Display from membership_finances data:
   - Monthly Rate: $299.00
   - Monthly Discount: -$50.00
   - Monthly Finance Charge: +$10.00
   - Monthly Cost: $111.00 (calculated)
   - ─────────────────────────
   - Monthly Payment: $259.00 (calculated)
   - Monthly Margin: 63% (calculated)
3. Add visual divider between sections
4. Test: View membership - verify monthly section displays
5. Test: Verify calculations correct

#### Step 7.3: Create Lifetime Totals Section (Memberships Only)
1. Add new section: "Lifetime Totals" (only visible for memberships)
2. Display from program_finances and program data:
   - Billing Periods: X months (calculated from max billing_period_month)
   - Member Since: [start_date formatted]
   - Total Revenue: $X (total_charge)
   - Total Discounts: -$X (cumulative discounts)
   - Total Finance Charges: +$X (cumulative finance_charges)
   - Total Cost: $X (total_cost)
   - ─────────────────────────
   - Total Payments: $X (sum of all payments OR final calculated amount)
   - Lifetime Margin: X% (calculated)
3. Test: View membership with multiple periods - verify totals correct
4. Test: Verify margin calculation accurate

#### Step 7.4: Maintain One-Time Program Display
1. Ensure one-time programs show existing financials display unchanged
2. Do not show "Current Period" or "Lifetime Totals" sections
3. Test: View one-time program - verify display unchanged from current

#### Step 7.5: Handle Quote Stage Display (Memberships)
1. For memberships in Quote status:
   - Show projected monthly values (editable)
   - Note that values will be locked upon activation
2. Add info message: "These values will be locked when the program is activated"
3. Test: View Quote membership - verify editable and message shows

#### Phase 7 Checkpoint
- [ ] Labels change based on program type
- [ ] Monthly summary section displays for memberships
- [ ] Lifetime totals section displays for memberships
- [ ] Calculations accurate
- [ ] One-time programs unchanged
- [ ] Quote stage shows appropriate messaging

---

### Phase 8: UI Components - Items Tab

**Duration:** 2-3 days  
**Dependencies:** Phase 7 complete  
**Risk Level:** Medium

#### Step 8.1: Add Billing Period Filter
1. Open `src/components/programs/program-items-tab.tsx`
2. Add dropdown filter (only visible for memberships):
   - "View Billing Period"
   - Options: "All Periods", "Period 1", "Period 2", ... "Period N"
3. Default to "All Periods" or "Current Period"
4. Filter items based on selection
5. Test: Filter by period - verify correct items shown

#### Step 8.2: Add Billing Period Column
1. Add "Billing Period" column to items table
2. Only visible when viewing "All Periods" or for memberships generally
3. Display "Month 1", "Month 2", etc. (or just the number)
4. Test: View all periods - verify column shows
5. Test: View one-time program - verify column hidden or shows N/A

#### Step 8.3: Implement Item Locking for Active Memberships
1. Add logic to detect if program is:
   - Type = 'membership' AND
   - Status = 'Active' (or beyond Quote)
2. If locked:
   - Disable all edit buttons
   - Disable all delete buttons
   - Hide "Add Item" button
3. Show lock banner/message: "Items cannot be edited after activation for membership programs"
4. Test: View Active membership - verify all controls disabled
5. Test: View Quote membership - verify all controls enabled
6. Test: View one-time program (any status) - verify controls based on existing rules

#### Step 8.4: Add Visual Lock Indicators
1. Add lock icon (🔒) next to items or in header for locked memberships
2. Consider graying out the items section when locked
3. Tooltip on lock: "Membership items are locked after activation to ensure consistent monthly billing"
4. Test: Visual indication clear that items are locked

#### Step 8.5: Maintain One-Time Program Behavior
1. Verify one-time programs maintain current item editing rules
2. No billing period filter shown for one-time programs
3. Items editable based on existing business rules
4. Test: Full regression on one-time program items functionality

#### Phase 8 Checkpoint
- [ ] Billing period filter works for memberships
- [ ] Billing period column displays correctly
- [ ] Items locked for Active memberships
- [ ] Lock indicators visible and clear
- [ ] One-time programs unchanged
- [ ] Add/Edit/Delete buttons properly disabled when locked

---

### Phase 9: UI Components - Payments Tab

**Duration:** 2 days  
**Dependencies:** Phase 8 complete  
**Risk Level:** Low

#### Step 9.1: Add Quote Stage Messaging (Memberships)
1. Open `src/components/programs/program-payments-tab.tsx`
2. For memberships in Quote status:
   - Show info banner: "ℹ️ Payments will be generated monthly after activation"
   - Do not show empty payments table (or show with message)
3. Test: View Quote membership - verify message displays

#### Step 9.2: Add Billing Period Column
1. Add "Billing Period" column to payments table
2. Display "Month 1", "Month 2", etc. based on payment notes or calculated from dates
3. Consider grouping payments by period visually
4. Test: View membership with multiple payments - verify periods shown

#### Step 9.3: Add Payment Summary Section
1. Add summary section at top of payments tab for memberships:
   - Payment Status: Current / Overdue / Pending
   - Next Payment Due: [date]
   - Total Paid to Date: $X
   - Outstanding Balance: $X
2. Calculate values from payments data
3. Test: Verify summary calculations correct

#### Step 9.4: Visual Payment Grouping (Optional Enhancement)
1. Group payments visually:
   - Paid (collapsed or at bottom)
   - Upcoming (expanded, prominent)
   - Overdue (highlighted in red/warning color)
2. Test: Visual grouping clear and helpful

#### Step 9.5: Maintain One-Time Program Display
1. Verify one-time programs show payments as currently implemented
2. Summary section may also be useful for one-time (consider adding)
3. Test: One-time program payments unchanged or enhanced consistently

#### Phase 9 Checkpoint
- [ ] Quote stage shows appropriate message
- [ ] Billing period column displays for memberships
- [ ] Payment summary section displays correctly
- [ ] Visual grouping helps identify payment status
- [ ] One-time programs unchanged

---

### Phase 10: UI Components - Tasks & Script Tabs

**Duration:** 1-2 days  
**Dependencies:** Phase 9 complete  
**Risk Level:** Low

#### Step 10.1: Add Billing Period Filter to Tasks Tab
1. Open `src/components/programs/program-tasks-tab.tsx`
2. Add billing period filter dropdown (memberships only)
3. Default to current period
4. Filter tasks based on period selection
5. Test: Filter tasks by period

#### Step 10.2: Add Billing Period Filter to Script Tab
1. Open `src/components/programs/program-script-tab.tsx`
2. Add billing period filter dropdown (memberships only)
3. Add note showing: "Showing schedule for Month N ([date range])"
4. Filter schedule based on period selection
5. Test: Filter schedule by period

#### Step 10.3: Maintain Existing Functionality
1. Verify To Do tab needs no changes (works for both types)
2. Verify RASHA tab needs no changes (works for both types)
3. Test: To Do and RASHA tabs function correctly for memberships

#### Phase 10 Checkpoint
- [ ] Tasks tab has period filter for memberships
- [ ] Script tab has period filter for memberships
- [ ] Date range note displays correctly
- [ ] To Do and RASHA tabs unchanged and working

---

### Phase 11: Programs Grid/List Updates

**Duration:** 1 day  
**Dependencies:** Phase 10 complete  
**Risk Level:** Low

#### Step 11.1: Add Type Column
1. Open programs list/grid component
2. Add "Type" column
3. Display badge: 🔵 "Program" or 🟢 "Membership"
4. Consider color-coded chips or icons
5. Test: Type column displays correctly

#### Step 11.2: Add Type Filter
1. Add filter dropdown: "Program Type"
2. Options: "All", "One-Time Programs", "Memberships"
3. Filter grid based on selection
4. Persist filter preference (if other filters are persisted)
5. Test: Filter works correctly

#### Step 11.3: Consider Sorting
1. Add ability to sort by program type if not automatic
2. Test: Sorting works correctly

#### Phase 11 Checkpoint
- [ ] Type column visible in grid
- [ ] Type filter works correctly
- [ ] Visual distinction clear between types

---

### Phase 12: Monthly Processing Job

**Duration:** 3-4 days  
**Dependencies:** All UI phases complete  
**Risk Level:** High

#### Step 12.1: Design Job Architecture
1. Decide on job execution method:
   - Supabase Edge Function with cron trigger
   - External cron service calling API endpoint
   - Vercel Cron (if using Vercel)
2. Document chosen approach
3. Plan for job monitoring and alerting

#### Step 12.2: Create Monthly Processing Function
1. Create function/endpoint: `processMonthlyMemberships()`
2. Implement logic:
   - Query all Active memberships where next_billing_date - 7 days <= TODAY
   - For each membership, check if payment already exists for this billing date (idempotency)
   - If payment exists, skip
   - If no payment exists, process this membership
3. Test: Function identifies correct memberships to process

#### Step 12.3: Implement Single Membership Processing
1. Create function: `processSingleMembership(programId)`
2. Logic flow:
   - Get membership finances (locked monthly values)
   - Get current program finances (cumulative values)
   - Get max billing_period_month from items
   - Calculate next period number (max + 1)
   - Clone all Period 1 items to Period N (new billing_period_month)
   - Update program_finances: increment discounts by monthly_discount
   - Update program_finances: increment finance_charges by monthly_finance_charge
   - Calculate payment: monthly_rate - monthly_discount + monthly_finance_charge
   - Create payment record with due_date = next_billing_date, status = pending
   - Update next_billing_date to start_date + N months (anchor-based)
   - Generate schedule for new period items
3. Wrap in transaction
4. Test: Process single membership - verify all data created correctly

#### Step 12.4: Implement Item Cloning Logic
1. Create function: `clonePeriod1Items(programId, newPeriodNumber)`
2. Query all items where billing_period_month = 1
3. For each item, insert new record with:
   - Same therapy_id, quantity, item_charge, item_cost, etc.
   - billing_period_month = newPeriodNumber
4. Test: Items cloned correctly with new period

#### Step 12.5: Implement Schedule Generation for New Items
1. Ensure existing schedule generation logic works for new period items
2. Calculate appropriate dates based on new billing period
3. Test: Schedule created for new period items

#### Step 12.6: Set Up Cron Schedule
1. Configure cron to run daily (e.g., 2:00 AM)
2. Set up job to call processMonthlyMemberships
3. Test: Job runs on schedule

#### Step 12.7: Implement Logging and Monitoring
1. Log start and end of each job run
2. Log each membership processed
3. Log any errors with program ID
4. Set up alerts for job failures
5. Test: Logs appear correctly

#### Step 12.8: Implement Error Handling
1. If single membership fails, log error and continue to next
2. Do not let one failure stop all processing
3. Consider retry logic for transient failures
4. Test: One failed membership doesn't block others

#### Phase 12 Checkpoint
- [ ] Monthly job runs on schedule
- [ ] Correct memberships identified for processing
- [ ] Items cloned correctly
- [ ] Payments created correctly
- [ ] Finances updated correctly (cumulative)
- [ ] next_billing_date updated correctly
- [ ] Idempotency working (no duplicates)
- [ ] Error handling prevents cascade failures
- [ ] Logging and monitoring in place

---

### Phase 13: Integration Testing

**Duration:** 2-3 days  
**Dependencies:** Phase 12 complete  
**Risk Level:** Medium

#### Step 13.1: End-to-End One-Time Program Testing
1. Create new one-time program
2. Add items
3. Configure financials
4. Activate program
5. Verify all existing functionality unchanged
6. Complete program
7. Verify completion works

#### Step 13.2: End-to-End Membership Program Testing
1. Create new membership program
2. Verify program type selected and locked after save
3. Verify duration field disabled
4. Verify financing type locked to Full Pay
5. Add items
6. Configure financials (discounts, finance charges)
7. Verify monthly calculations display correctly
8. Activate program
9. Verify:
   - Items locked (cannot edit)
   - Membership finances record created
   - First payment created
   - next_billing_date set
   - All items marked as Period 1
10. Wait for or simulate monthly job
11. Verify:
    - Period 2 items created
    - Second payment created
    - Finances incremented
    - next_billing_date advanced
12. Check financials tab - verify monthly and lifetime sections
13. Check items tab - verify periods filter works
14. Check payments tab - verify periods display

#### Step 13.3: Status Transition Testing (Memberships)
1. Test: Quote → Active (verify activation logic)
2. Test: Active → Paused (verify job skips paused)
3. Test: Paused → Active (verify resumes correctly)
4. Test: Active → Cancelled (verify job stops)
5. Test: Cannot transition to Completed

#### Step 13.4: Edge Case Testing
1. Test: Membership with no items at activation (should reject or handle)
2. Test: Multiple memberships due on same day (all processed)
3. Test: Membership with past next_billing_date (catch-up or single process)
4. Test: Very old membership with many periods (performance)

#### Step 13.5: Financial Accuracy Testing
1. Create membership with known values
2. Process several months
3. Manually calculate expected cumulative values
4. Verify system values match manual calculations
5. Verify margin calculations accurate

#### Phase 13 Checkpoint
- [ ] One-time programs pass full regression
- [ ] Membership programs work end-to-end
- [ ] Status transitions correct
- [ ] Edge cases handled
- [ ] Financial calculations verified accurate

---

### Phase 14: Documentation and Training

**Duration:** 1-2 days  
**Dependencies:** Phase 13 complete  
**Risk Level:** Low

#### Step 14.1: Update User Documentation
1. Document how to create a membership program
2. Document differences from one-time programs
3. Document what happens each month (automated)
4. Document what cannot be changed after activation
5. Add screenshots of new UI elements

#### Step 14.2: Update Admin Procedures
1. Document how to manually correct billing issues
2. Document how to add missed items/payments
3. Document how to handle cancellations
4. Document how to handle paused memberships

#### Step 14.3: Update Technical Documentation
1. Document database schema changes
2. Document API endpoint changes
3. Document monthly job operation
4. Document monitoring and alerting

#### Phase 14 Checkpoint
- [ ] User documentation complete
- [ ] Admin procedures documented
- [ ] Technical documentation updated

---

### Phase 15: Production Deployment

**Duration:** 1 day  
**Dependencies:** All previous phases complete  
**Risk Level:** High

#### Step 15.1: Pre-Deployment Checklist
1. All phases completed and signed off
2. All tests passing
3. Documentation updated
4. Backup strategy confirmed
5. Rollback plan documented
6. Stakeholders notified of deployment

#### Step 15.2: Database Migration
1. Apply database migrations to production
2. Verify columns and tables created
3. Verify existing data unaffected
4. Verify backfill completed (all programs = 'one-time')

#### Step 15.3: Deploy Application Code
1. Deploy API changes
2. Deploy UI changes
3. Verify application starts correctly
4. Verify no console errors

#### Step 15.4: Enable Monthly Job
1. Deploy cron job configuration
2. Verify job is scheduled
3. Verify job has necessary permissions
4. Monitor first job execution

#### Step 15.5: Post-Deployment Verification
1. Create test membership in production
2. Verify all features work
3. Monitor for errors
4. Check performance metrics

#### Step 15.6: Communication
1. Notify users of new feature
2. Provide training resources
3. Establish support channel for questions

#### Phase 15 Checkpoint
- [ ] Database migrations applied successfully
- [ ] Application deployed and running
- [ ] Monthly job deployed and running
- [ ] Test membership created successfully
- [ ] No errors in production logs
- [ ] Users notified

---

### Post-Implementation Monitoring

**Duration:** Ongoing  
**Dependencies:** Phase 15 complete

#### Ongoing Tasks
1. Monitor monthly job execution daily
2. Review any job failures immediately
3. Monitor membership financial accuracy weekly
4. Gather user feedback
5. Track any issues or enhancement requests
6. Plan for Phase 2 features (quarterly/annual billing, upgrades, etc.)

---

## Implementation Timeline Summary

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| Pre | Review & Preparation | 1 day | None |
| 1 | Database Schema | 2-3 days | None |
| 2 | Backend Validation & Types | 1-2 days | Phase 1 |
| 3 | API Routes - Read | 2 days | Phase 2 |
| 4 | API Routes - Write | 3-4 days | Phase 3 |
| 5 | React Query Hooks | 2 days | Phase 4 |
| 6 | UI - Program Info Tab | 2-3 days | Phase 5 |
| 7 | UI - Financials Tab | 2-3 days | Phase 6 |
| 8 | UI - Items Tab | 2-3 days | Phase 7 |
| 9 | UI - Payments Tab | 2 days | Phase 8 |
| 10 | UI - Tasks & Script Tabs | 1-2 days | Phase 9 |
| 11 | UI - Programs Grid | 1 day | Phase 10 |
| 12 | Monthly Processing Job | 3-4 days | Phase 11 |
| 13 | Integration Testing | 2-3 days | Phase 12 |
| 14 | Documentation | 1-2 days | Phase 13 |
| 15 | Production Deployment | 1 day | Phase 14 |

**Total Estimated Duration:** 25-35 working days (5-7 weeks)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Monthly job fails | Idempotency prevents duplicates; daily monitoring; alerting |
| Financial calculations wrong | Extensive testing phase; manual verification before production |
| Users confused by changes | Documentation; training; gradual rollout |
| Performance issues with many memberships | Test with volume; optimize queries; batch processing |
| Existing programs affected | All changes additive; explicit regression testing |

---

## Success Criteria

1. ✅ One-time programs function exactly as before
2. ✅ Membership programs can be created, activated, and billed monthly
3. ✅ Financial calculations accurate (verified manually)
4. ✅ Monthly job runs reliably without duplicates
5. ✅ UI clearly distinguishes program types
6. ✅ Items properly locked after membership activation
7. ✅ No production errors or data corruption
8. ✅ Users can successfully create and manage memberships

---

**End of Implementation Plan**

---

**End of Document**






