# Tax Data Cleanup Strategy

**Date**: October 27, 2025  
**Purpose**: Fix corrupted tax data in database without impacting locked contracted values

---

## Strategy Overview

### ✅ What We WILL Change
1. **taxes** - Recalculate to correct values
2. **variance** - Recalculate based on new taxes
3. **margin** - Recalculate based on locked price (for Active programs)

### 🔒 What We WILL NOT Change
1. **contracted_at_margin** - LOCKED (set when program went Active)
2. **final_total_price** - LOCKED (set when program went Active)

---

## Why This Is Safe

### For Quote Programs
- **Nothing is locked** - can safely recalculate everything
- Update: taxes, margin, final_total_price
- Risk: **ZERO** (no locked values to protect)

### For Active Programs
- **contracted_at_margin is LOCKED** - represents the contracted commitment
- **final_total_price is LOCKED** - represents what customer agreed to pay
- **taxes are FLEXIBLE** - allow for item additions/removals
- Update: taxes, variance (projected - locked), margin (on locked price)
- Risk: **LOW** (locked values explicitly preserved)

### For Other Status Programs (Paused, Completed, etc.)
- Same as Active - locked values protected
- Update: taxes, variance, margin
- Risk: **LOW** (locked values explicitly preserved)

---

## The Math

### Tax Calculation (All Programs)
```
taxablePercentage = totalTaxableCharge / totalCharge
taxableDiscount = |discount| × taxablePercentage
discountedTaxable = totalTaxableCharge - taxableDiscount
taxes = discountedTaxable × 0.0825
```

### Quote Programs: Recalculate Everything
```
projectedPrice = totalCharge + taxes + financeCharges - |discounts|
margin = ((projectedPrice - totalCost) / projectedPrice) × 100
```

### Active Programs: Respect Locked Values
```
projectedPrice = totalCharge + taxes + financeCharges - |discounts|
variance = projectedPrice - lockedPrice  ← Shows over/under delivery
margin = ((lockedPrice - totalCost) / lockedPrice) × 100  ← Actual profitability
```

**Key Insight**: For Active programs, margin is calculated on **locked price**, not projected price. This shows the **actual profitability** on what the customer is paying.

---

## Step-by-Step Execution Plan

### Step 1: Preview (MANDATORY)
```sql
-- See scripts/fix-corrupted-taxes.sql - Step 1
-- Shows which programs will be affected and by how much
```

**What to Look For**:
- ✅ Are the `correct_taxes` values reasonable?
- ✅ Is `tax_difference` consistent with investigation findings?
- ✅ Are `locked_margin` and `locked_price` present for Active programs?
- ❌ Any programs with $0 locked price but Active status? (investigate separately)

---

### Step 2: Backup (CRITICAL!)
```sql
CREATE TABLE member_program_finances_backup_20251027 AS
SELECT * FROM member_program_finances;
```

**Why**: If anything goes wrong, we can rollback in seconds.

---

### Step 3A: Fix Quote Programs
```sql
-- See scripts/fix-corrupted-taxes.sql - Step 3A
```

**What Happens**:
- Recalculates taxes from current items
- Recalculates margin and final_total_price
- No locked values to worry about

**Expected Result**: All Quote programs have correct taxes, margin, price

---

### Step 3B: Fix Active Programs
```sql
-- See scripts/fix-corrupted-taxes.sql - Step 3B
```

**What Happens**:
- Recalculates taxes from current items
- Updates variance (projected - locked)
- Updates margin **on locked price**
- **Does NOT touch**: contracted_at_margin, final_total_price

**Expected Result**: All Active programs have correct taxes, variance, margin. Locked values unchanged.

---

### Step 3C: Fix Other Status Programs
```sql
-- See scripts/fix-corrupted-taxes.sql - Step 3C
```

**What Happens**:
- Same as Active programs
- Treats all non-Quote statuses as locked

---

### Step 4: Verification
```sql
-- See scripts/fix-corrupted-taxes.sql - Step 4
```

**Checks**:
- 4A: Any remaining tax discrepancies? (should be ZERO)
- 4B: Were locked values preserved? (should be YES for all)
- 4C: Summary of changes (average, min, max tax changes)

---

## Expected Results

### Counts to Verify

| Status | Programs | Taxes Updated | Locked Values Changed |
|--------|----------|---------------|----------------------|
| Quote | ~X | YES | N/A (none locked) |
| Active | ~Y | YES | NO (preserved) |
| Other | ~Z | YES | NO (preserved) |

*Replace X, Y, Z with actual counts from Step 1 preview*

### Audit Report
**Before Fix**: Shows tax discrepancies for ~N programs  
**After Fix**: Shows ZERO tax discrepancies

---

## Business Logic Preserved

### Quote Programs
- ✅ Margin calculated on projected price
- ✅ Price is flexible (can change with items/discount)
- ✅ Nothing is locked

### Active Programs
- ✅ contracted_at_margin is LOCKED (business commitment preserved)
- ✅ final_total_price is LOCKED (customer agreement preserved)
- ✅ variance shows over/under delivery
- ✅ margin shows actual profitability on locked price
- ✅ taxes reflect current items (flexible to allow adds/removes)

**Critical Validation**:
```
For Active programs, ALWAYS verify:
1. contracted_at_margin = [value before fix]
2. final_total_price = [value before fix]
3. variance = projectedPrice - final_total_price
4. margin = ((final_total_price - totalCost) / final_total_price) × 100
```

---

## Rollback Plan

If something goes wrong:

```sql
UPDATE member_program_finances mpf
SET 
  taxes = bkp.taxes,
  margin = bkp.margin,
  variance = bkp.variance,
  final_total_price = bkp.final_total_price,
  contracted_at_margin = bkp.contracted_at_margin,
  updated_at = bkp.updated_at
FROM member_program_finances_backup_20251027 bkp
WHERE mpf.member_program_id = bkp.member_program_id;
```

**Time to Rollback**: < 10 seconds

---

## Risk Assessment

### Overall Risk: **VERY LOW** ✅

| Risk | Mitigation |
|------|------------|
| Data loss | Full backup created first |
| Locked values changed | Explicit preservation in SQL |
| Wrong calculation | Uses same formula as API |
| Concurrent updates | Run during low-traffic period |
| Performance impact | All queries are indexed |

---

## Execution Checklist

**Pre-Execution**:
- [ ] Review Step 1 preview output
- [ ] Verify counts are reasonable
- [ ] Confirm backup strategy
- [ ] Schedule during maintenance window (optional but recommended)

**Execution**:
- [ ] Run Step 1: Preview
- [ ] Run Step 2: Backup (CRITICAL!)
- [ ] Run Step 3A: Fix Quote programs
- [ ] Run Step 3B: Fix Active programs
- [ ] Run Step 3C: Fix Other programs
- [ ] Run Step 4A: Verify no remaining discrepancies
- [ ] Run Step 4B: Verify locked values preserved
- [ ] Run Step 4C: Summary of changes

**Post-Execution**:
- [ ] Check audit report in application (should show zero discrepancies)
- [ ] Verify a few programs manually (compare before/after)
- [ ] Monitor for user-reported issues
- [ ] Keep backup table for 30 days, then drop

---

## Example: Program #47 (Craig Reiners)

### Before Fix
```
stored_taxes: $198.84
calculated_taxes: $229.53
difference: $30.69 ❌
contracted_at_margin: 45.2% (LOCKED)
final_total_price: $3,890.00 (LOCKED)
```

### After Fix
```
stored_taxes: $229.53 ✅ (corrected)
calculated_taxes: $229.53 ✅ (matches)
difference: $0.00 ✅
contracted_at_margin: 45.2% ✅ (UNCHANGED)
final_total_price: $3,890.00 ✅ (UNCHANGED)
variance: recalculated based on new taxes
margin: recalculated on locked price
```

---

## Questions & Answers

### Q: Why not just recalculate everything?
**A**: Because locked values (contracted_at_margin, final_total_price) represent business commitments. Changing them would break contracts.

### Q: Will this affect what customers owe?
**A**: No. For Active programs, `final_total_price` (what customer pays) is LOCKED and will not change.

### Q: What about programs with paid payments?
**A**: Their locked values are protected. We only fix the tax calculation, which is allowed to be flexible.

### Q: How long will this take?
**A**: 
- Preview: 5 seconds
- Backup: 1 second
- Fix all programs: 10-30 seconds
- Verification: 10 seconds
- Total: < 1 minute

### Q: What if I run it twice by accident?
**A**: Safe! The script only updates programs where `ABS(stored_taxes - correct_taxes) > 0.01`. If taxes are already correct, it skips them.

### Q: Can I run this in production?
**A**: Yes, it's safe. But recommend:
1. Run preview first
2. Test on a non-critical program manually
3. Then run full fix during low-traffic period

---

## Success Criteria

✅ **Fix is Successful If**:
1. All programs show correct taxes in audit report
2. Zero tax discrepancies in audit report
3. All Active programs have unchanged contracted_at_margin
4. All Active programs have unchanged final_total_price
5. Variance and margin recalculated correctly for Active programs
6. No user-reported issues with financials

---

## Timeline

**Estimated Total Time**: 30 minutes

| Step | Time | Description |
|------|------|-------------|
| 1. Preview | 5 min | Review what will change |
| 2. Backup | 1 min | Create safety net |
| 3. Execute | 2 min | Run all fix queries |
| 4. Verify | 10 min | Check results thoroughly |
| 5. Audit Report | 5 min | Confirm zero discrepancies |
| 6. Manual Spot Check | 7 min | Verify 5-10 programs manually |

---

## Contact & Support

If issues arise during execution:
1. **Stop immediately**
2. **Do not proceed to next step**
3. **Run verification queries to understand state**
4. **Consider rollback if needed**
5. **Review AUDIT_TAX_DISCREPANCY_ROOT_CAUSE_AND_FIX.md** for context

---

## Sign-Off

**Strategy Reviewed By**: _________________  
**Date**: _________________  
**Approved for Execution**: [ ] YES [ ] NO

**Notes**:
```



```


