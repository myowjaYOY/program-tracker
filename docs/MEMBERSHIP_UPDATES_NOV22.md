# Membership Programs Design - November 22, 2025 Updates

## Summary of Changes

This document summarizes the key revisions made to the Membership Programs design on November 22, 2025.

---

## Major Changes

### 1. **Simplified Database Schema**

**Before:** Separate `program_types` lookup table with foreign key
```sql
CREATE TABLE program_types (...)
ALTER TABLE member_programs ADD COLUMN program_type_id INTEGER REFERENCES program_types(...)
```

**After:** Simple TEXT field with check constraint
```sql
ALTER TABLE member_programs 
ADD COLUMN program_type TEXT CHECK (program_type IN ('one-time', 'membership'))
```

**Benefit:** Simpler schema, no joins needed, easier to maintain

---

### 2. **New Separate Finances Table**

**Added:** `member_program_membership_finances` table
- Stores **locked monthly values** at activation
- Only exists for membership programs
- Separate from cumulative totals in `member_program_finances`

**Fields:**
- `monthly_rate` - Items total per month (locked)
- `monthly_discount` - Discount per month (locked)
- `monthly_finance_charge` - Finance charge per month (locked)
- `billing_frequency` - 'monthly' (hard-coded for now)

**Why:** Clean separation of monthly template vs lifetime accumulation

---

### 3. **Financial Accumulation Logic Documented**

**Key Insight:** Discounts and finance charges **accumulate** each period to maintain consistent monthly payments.

**Example:**
```
Month 1: $299 items, -$50 discount, +$10 finance → $259 payment
Month 2: $598 items, -$100 discount, +$20 finance → $259 payment
Month 3: $897 items, -$150 discount, +$30 finance → $259 payment
```

Each period:
- Add `monthly_discount` to cumulative discounts
- Add `monthly_finance_charge` to cumulative finance charges
- Payment stays consistent!

---

### 4. **Item Locking After Activation**

**Critical Rule:** For memberships, **Period 1 items become READ-ONLY** after activation.

**Rationale:**
- Period 1 items are the "monthly template"
- Locked values ensure consistency
- Cannot change monthly rate after activation
- One-time programs: Items still editable (no change)

**UI Impact:**
- Show lock icon/banner
- Disable edit/delete buttons
- No "Add Item" button for active memberships

---

### 5. **Program Creation Workflow Documented**

**Clarified:** How to create memberships vs one-time programs

**Key Points:**
- Program type selected during creation (cannot change after)
- Duration: blank/disabled for memberships
- Financing Type: locked to "Full Pay" for memberships
- Both types start as Quote → Active lifecycle
- Items editable until activation
- Templates work the same for both types

---

### 6. **Billing Frequency Hidden for Now**

**Field exists** in database but **not shown in UI**
- Hard-coded to 'monthly' in backend
- Future-proof: Can expose dropdown later
- No schema changes needed when ready

---

### 7. **Monthly Job Timing - 7 Day Advance**

**Changed:** Generate items/payments **7 days before** `next_billing_date`

**Benefits:**
- Time to review before due date
- Opportunity to make adjustments
- Avoids last-minute generation issues

**Idempotency:** Check if payment already exists to prevent duplicates

---

### 8. **Removed from Schema**

**Not needed:**
- ❌ `billing_frequency` on `member_programs` (moved to membership_finances)
- ❌ `program_types` table (using check constraint instead)

**Kept:**
- ✅ `next_billing_date` on `member_programs`
- ✅ `billing_period_month` on `member_program_items`

---

## Database Schema Summary (Final)

### Tables Modified:
```sql
-- member_programs
ALTER TABLE member_programs
ADD COLUMN program_type TEXT CHECK (program_type IN ('one-time', 'membership')) NOT NULL DEFAULT 'one-time',
ADD COLUMN next_billing_date DATE;

-- member_program_items  
ALTER TABLE member_program_items
ADD COLUMN billing_period_month INTEGER;
```

### Tables Created:
```sql
-- member_program_membership_finances (NEW)
CREATE TABLE member_program_membership_finances (
  membership_finance_id SERIAL PRIMARY KEY,
  member_program_id INTEGER UNIQUE NOT NULL REFERENCES member_programs(member_program_id) ON DELETE CASCADE,
  monthly_rate NUMERIC(10,2) NOT NULL,
  monthly_discount NUMERIC(10,2) DEFAULT 0,
  monthly_finance_charge NUMERIC(10,2) DEFAULT 0,
  billing_frequency TEXT DEFAULT 'monthly' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  CONSTRAINT check_billing_frequency CHECK (billing_frequency IN ('monthly', 'quarterly', 'annual'))
);
```

### Tables Unchanged:
- `member_program_finances` (stores cumulative totals)
- `member_program_payments` (just more rows)
- All other program tables

---

## UI Changes Summary

### Program Info Tab:
- ✅ Add Program Type dropdown (prominent)
- ✅ Duration: blank/disabled for memberships
- ✅ Financing Type: locked to "Full Pay" for memberships
- ✅ Status: remove "Completed" for memberships
- ❌ Billing frequency: NOT shown (hidden)

### Financials Tab:
- ✅ Change label to "Monthly Rate" for memberships
- ✅ Show Current Period section (locked monthly values)
- ✅ Show Lifetime Totals section (cumulative values)

### Items Tab:
- ✅ Lock Period 1 items after activation (memberships only)
- ✅ Show lock icon/banner
- ✅ Add billing period filter
- ❌ No "Add Item" button for active memberships

### Payments Tab:
- ✅ Show message in Quote: "Payments will be generated monthly after activation"
- ✅ Add billing period column
- ✅ Add payment summary section

---

## Implementation Impact

### Simpler Than Original Design:
✅ No program_types table to maintain  
✅ No lookup table joins needed  
✅ Cleaner separation with dedicated finances table  
✅ More explicit about locking behavior  

### More Robust:
✅ Financial accumulation logic documented  
✅ Idempotency checks for monthly generation  
✅ 7-day advance prevents issues  
✅ Clear activation workflow  

### Future-Proof:
✅ Billing frequency field ready for quarterly/annual  
✅ Easy to extend membership_finances table  
✅ Check constraint allows adding new program types  

---

## Next Steps

1. Review updated design document
2. Begin Phase 1: Database changes
3. Create migration scripts
4. Test database schema
5. Proceed to backend API implementation

---

**Document Updated:** November 22, 2025  
**Full Design:** See `membership-programs-design.md`

