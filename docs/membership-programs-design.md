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

**End of Document**






