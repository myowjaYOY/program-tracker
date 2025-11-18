# Membership Programs - Design Document

**Date:** November 9, 2025  
**Status:** Design Phase - Ready for Implementation

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

### 1. NEW TABLE: `program_types`

**Purpose:** Define program type taxonomy

```sql
CREATE TABLE program_types (
  program_type_id SERIAL PRIMARY KEY,
  type_name TEXT NOT NULL,
  description TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

-- Seed data
INSERT INTO program_types (program_type_id, type_name, description, is_recurring) VALUES
  (1, 'One-Time Program', 'Traditional fixed-term program with upfront payment schedule', false),
  (2, 'Membership', 'Recurring monthly membership with month-to-month billing', true);
```

**Columns:**
- `program_type_id` - Primary key
- `type_name` - Display name ("One-Time Program", "Membership")
- `description` - Explanation of program type
- `is_recurring` - Boolean flag for recurring billing logic
- Standard audit fields

---

### 2. MODIFY TABLE: `member_programs`

**Add these columns:**

```sql
ALTER TABLE member_programs
ADD COLUMN program_type_id INTEGER REFERENCES program_types(program_type_id),
ADD COLUMN billing_frequency TEXT,
ADD COLUMN next_billing_date DATE;

CREATE INDEX idx_member_programs_type ON member_programs(program_type_id);

-- Set default for existing programs
UPDATE member_programs 
SET program_type_id = 1 
WHERE program_type_id IS NULL;
```

**New Columns:**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `program_type_id` | INTEGER (FK) | No | Links to program_types (1=One-Time, 2=Membership) |
| `billing_frequency` | TEXT | Yes | 'monthly', 'quarterly', 'annual' (for memberships only) |
| `next_billing_date` | DATE | Yes | When next payment/items are due (for memberships only) |

**Existing Columns - Behavior Changes:**

| Column | One-Time Program | Membership Program |
|--------|-----------------|-------------------|
| `start_date` | Program start date | Membership start date |
| `duration` | Used (e.g., 180 days) | Ignored (set to NULL or 30) |
| `total_charge` | Fixed program price | Accumulates monthly (Month 1: $299, Month 10: $2,990) |
| `total_cost` | Fixed program cost | Accumulates monthly |
| `program_status_id` | All statuses valid | Quote, Active, Paused, Cancelled only (no Completed) |

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

- ✅ `member_program_finances`
- ✅ `member_program_payments` (just more rows for memberships)
- ✅ `member_program_item_schedule`
- ✅ `member_program_item_tasks`
- ✅ `member_program_rasha`
- ✅ `program_status`
- ✅ All other program-related tables

---

## Business Logic & Workflows

### Monthly Processing Workflow (Memberships Only)

**Trigger:** Daily cron job or manual "Generate Next Period" action

**For each Active Membership where `next_billing_date <= TODAY`:**

1. **Calculate billing period number:**
   ```typescript
   const maxPeriod = await db.query(
     'SELECT MAX(billing_period_month) FROM member_program_items WHERE member_program_id = ?',
     [programId]
   );
   const nextPeriod = (maxPeriod || 0) + 1;
   ```

2. **Clone items from Period 1 (template) to new period:**
   ```typescript
   const templateItems = await getItems(programId, billing_period: 1);
   
   for (const item of templateItems) {
     await createItem({
       member_program_id: programId,
       therapy_id: item.therapy_id,
       quantity: item.quantity,
       item_cost: item.item_cost,
       item_charge: item.item_charge,
       billing_period_month: nextPeriod,
       // Copy all other fields...
     });
   }
   ```

3. **Program totals auto-recalculate (trigger or recalc):**
   ```sql
   UPDATE member_programs
   SET 
     total_charge = (SELECT SUM(item_charge * quantity) FROM member_program_items WHERE member_program_id = ?),
     total_cost = (SELECT SUM(item_cost * quantity) FROM member_program_items WHERE member_program_id = ?)
   WHERE member_program_id = ?;
   ```

4. **Create next payment:**
   ```typescript
   await createPayment({
     member_program_id: programId,
     payment_amount: monthlyRate, // From finances or items
     payment_due_date: program.next_billing_date,
     payment_status_id: PENDING,
     notes: `Month ${nextPeriod} membership payment`
   });
   ```

5. **Update next billing date:**
   ```sql
   UPDATE member_programs
   SET next_billing_date = DATE(start_date) + INTERVAL '1 month' * ?
   WHERE member_program_id = ?;
   ```

6. **Generate schedule for new period:**
   - Call existing schedule generation logic
   - Schedule relative to period start date

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
- "Program Type" (read-only after creation)
- "Billing Frequency" (Memberships only)
- "Next Billing Date" (Memberships only, read-only)

**Status dropdown changes:**
- Memberships: Remove "Completed" option
- One-Time: Keep all statuses

---

### 4. Financials Tab

**For One-Time Programs:**
- No changes (current display)

**For Memberships - Add two sections:**

**Section 1: Current Billing Period**
- Monthly Rate: $299
- Monthly Cost: $111
- Monthly Margin: 63%

**Section 2: Lifetime Totals**
- Billing Periods: 10 months
- Total Revenue: $2,990
- Total Cost: $1,110
- Lifetime Margin: 63%
- Member Since: [start_date]

---

### 5. Items Tab

**For Memberships - Add filter:**
- "View Billing Period" dropdown
  - Current Period (default)
  - All History
  - Period 1, Period 2, ... Period N

**Display changes:**
- Show "Billing Period" column when viewing All History
- Current Period: Editable
- Historical Periods: Read-only

**"Add Item" button:**
- Only adds to current billing period

---

### 6. Payments Tab

**For Memberships:**

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
- [ ] Create `program_types` table
- [ ] Add columns to `member_programs`
- [ ] Add column to `member_program_items`
- [ ] Create indexes
- [ ] Run data migration (set existing programs to type 1)
- [ ] Test database changes

### Phase 2: Backend API
- [ ] Update validation schemas (zod)
- [ ] Update `use-member-programs` hooks
- [ ] Create monthly processing function
- [ ] Add cron job for monthly generation
- [ ] Update API routes for program types
- [ ] Test API changes

### Phase 3: UI Components
- [ ] Update Program Form (add type selection)
- [ ] Update Program Info Tab (conditional fields)
- [ ] Update Financials Tab (lifetime section)
- [ ] Update Items Tab (billing period filter)
- [ ] Update Payments Tab (billing period column)
- [ ] Create Billing Period Filter component (reusable)
- [ ] Update Programs Grid (type column/filter)
- [ ] Test UI changes

### Phase 4: Business Logic
- [ ] Implement monthly item generation
- [ ] Implement monthly payment generation
- [ ] Implement status transition rules
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

**End of Document**





