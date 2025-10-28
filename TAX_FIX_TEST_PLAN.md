# Tax Recalculation Fix - Test Plan

**Fix**: Server-side tax recalculation in Financials API  
**Date**: October 27, 2025  
**File Modified**: `src/app/api/member-programs/[id]/finances/route.ts`

---

## Pre-Test Setup

### 1. Identify Test Program
- Find a **Quote** status program with items
- Verify it has both taxable and non-taxable items
- Note down current values:
  - Total Charge: $_______
  - Total Taxable Charge: $_______
  - Discount: $_______
  - Current Taxes: $_______

### 2. Prepare Browser
- Open browser DevTools (F12)
- Go to Console tab for logs
- Go to Network tab to monitor API calls

---

## Test Cases

### ✅ Test 1: Discount Change on Quote Program

**Objective**: Verify taxes recalculate when discount changes

**Steps**:
1. Navigate to Programs page
2. Select a Quote program with items
3. Go to Financials tab
4. Change discount amount (e.g., add $100 discount)
5. Click Save

**Expected Results**:
- ✅ Console shows `[Finances API] Tax recalculation for program X:`
- ✅ `recalculatedTaxes` value is different from `clientSentTaxes`
- ✅ UI updates to show new tax amount
- ✅ New tax amount is LOWER than before (due to discount)
- ✅ Program Audit page shows NO tax discrepancy

**Math Verification**:
```
Expected Tax = (TotalTaxableCharge - (Discount × TaxablePercentage)) × 0.0825

Where: TaxablePercentage = TotalTaxableCharge / TotalCharge
```

**Status**: ⬜ Pass | ⬜ Fail

**Notes**:
```


```

---

### ✅ Test 2: Finance Charges Change on Quote Program

**Objective**: Verify taxes DON'T change when only finance charges change

**Steps**:
1. Navigate to Programs page
2. Select a Quote program with items
3. Go to Financials tab
4. Note current tax amount: $_______
5. Change only finance charges (e.g., add $50)
6. Click Save

**Expected Results**:
- ✅ Console shows `[Finances API] Tax recalculation for program X:`
- ✅ Tax amount remains THE SAME (finance charges don't affect taxes)
- ✅ Program price increases by the finance charge amount
- ✅ No tax discrepancy in audit

**Status**: ⬜ Pass | ⬜ Fail

**Notes**:
```


```

---

### ✅ Test 3: Active Program (UI Lock Verification)

**Objective**: Verify Active programs are locked from discount changes in UI

**Steps**:
1. Navigate to Programs page
2. Select an **Active** status program
3. Go to Financials tab

**Expected Results**:
- ✅ Discount field is DISABLED (grayed out)
- ✅ Finance charges field is DISABLED
- ✅ Alert shown: "Program finances are locked..."
- ✅ Cannot modify discount or finance charges

**Status**: ⬜ Pass | ⬜ Fail

**Notes**:
```


```

---

### ✅ Test 4: Program with No Items

**Objective**: Verify taxes calculate to $0 when no items exist

**Steps**:
1. Create a new program (Quote status)
2. Set up finances (discount, financing type, etc.)
3. Save finances WITHOUT adding any items

**Expected Results**:
- ✅ Console shows `totalCharge: 0.00`
- ✅ Console shows `totalTaxableCharge: 0.00`
- ✅ Console shows `recalculatedTaxes: 0.00`
- ✅ Taxes field in UI shows $0.00
- ✅ No errors thrown

**Status**: ⬜ Pass | ⬜ Fail

**Notes**:
```


```

---

### ✅ Test 5: Program with No Taxable Items

**Objective**: Verify taxes calculate to $0 when all items are non-taxable

**Steps**:
1. Find or create a Quote program
2. Add only NON-TAXABLE items (e.g., services with taxable_flag = false)
3. Go to Financials tab
4. Add a discount
5. Save

**Expected Results**:
- ✅ Console shows `totalCharge: [value] > 0`
- ✅ Console shows `totalTaxableCharge: 0.00`
- ✅ Console shows `recalculatedTaxes: 0.00`
- ✅ Taxes field in UI shows $0.00
- ✅ Discount applied to program price

**Status**: ⬜ Pass | ⬜ Fail

**Notes**:
```


```

---

### ✅ Test 6: Large Discount (Edge Case)

**Objective**: Verify system handles discount > total charge gracefully

**Steps**:
1. Find Quote program with items
2. Total charge is, say, $1,000
3. Go to Financials tab
4. Enter discount of $1,500 (exceeds total)
5. Try to save

**Expected Results**:
- ✅ System allows save (no crash)
- ✅ Tax calculation doesn't go negative
- ✅ Warnings/validations may trigger (depending on business rules)
- ✅ No unhandled errors in console

**Status**: ⬜ Pass | ⬜ Fail

**Notes**:
```


```

---

### ✅ Test 7: Stale Cache Simulation (The Bug!)

**Objective**: Verify fix prevents stale cache from corrupting taxes

**Steps**:
1. Open Quote program in one browser tab
2. Go to Items tab, add several taxable items
3. Wait 10 seconds (let changes propagate)
4. In ANOTHER tab, open same program's Financials tab
5. DON'T refresh the page
6. Change discount amount in Financials tab
7. Save

**Expected Results**:
- ✅ Server recalculates taxes using FRESH data from database
- ✅ Console shows correct `totalTaxableCharge` (includes new items)
- ✅ Saved taxes are CORRECT (not based on old cached data)
- ✅ Audit page shows NO discrepancy
- ✅ This is the exact bug that was causing tax drift - now FIXED!

**Status**: ⬜ Pass | ⬜ Fail

**Notes**:
```


```

---

### ✅ Test 8: Concurrent Item Addition

**Objective**: Verify taxes stay correct when items are added while Financials tab is open

**Steps**:
1. Open Quote program, go to Financials tab
2. Note current values (DON'T close tab)
3. In another tab/window, go to same program's Items tab
4. Add 3 taxable items ($200 each)
5. Go back to Financials tab (DON'T refresh)
6. Change discount by $1
7. Save

**Expected Results**:
- ✅ API fetches fresh items from database
- ✅ Taxes recalculated based on NEW total (includes the 3 new items)
- ✅ Taxes are NOT based on stale browser cache
- ✅ Audit shows no discrepancy

**Status**: ⬜ Pass | ⬜ Fail

**Notes**:
```


```

---

## Verification Queries

### Check Taxes in Database
```sql
SELECT 
  mp.member_program_id,
  mp.program_name,
  mpf.taxes as stored_taxes,
  mpf.discounts,
  (SELECT COALESCE(SUM(charge * quantity), 0) 
   FROM member_program_items 
   WHERE member_program_id = mp.member_program_id 
   AND active_flag = true) as total_charge,
  (SELECT COALESCE(SUM(charge * quantity), 0) 
   FROM member_program_items 
   WHERE member_program_id = mp.member_program_id 
   AND active_flag = true
   AND taxable_flag = true) as total_taxable_charge
FROM member_programs mp
JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
WHERE mp.member_program_id = [TEST_PROGRAM_ID];
```

### Calculate Expected Tax Manually
```sql
WITH calc AS (
  SELECT 
    mp.member_program_id,
    COALESCE(SUM(mpi.charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(CASE WHEN mpi.taxable_flag THEN mpi.charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge,
    COALESCE(mpf.discounts, 0) as discounts
  FROM member_programs mp
  LEFT JOIN member_program_items mpi ON mp.member_program_id = mpi.member_program_id AND mpi.active_flag = true
  LEFT JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  WHERE mp.member_program_id = [TEST_PROGRAM_ID]
  GROUP BY mp.member_program_id, mpf.discounts
)
SELECT 
  member_program_id,
  total_charge,
  total_taxable_charge,
  discounts,
  (total_taxable_charge / NULLIF(total_charge, 0)) as taxable_percentage,
  (ABS(discounts) * (total_taxable_charge / NULLIF(total_charge, 0))) as taxable_discount,
  (total_taxable_charge - (ABS(discounts) * (total_taxable_charge / NULLIF(total_charge, 0)))) * 0.0825 as expected_taxes
FROM calc;
```

---

## Test Results Summary

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Discount Change | ⬜ | |
| 2 | Finance Charges | ⬜ | |
| 3 | Active Program Lock | ⬜ | |
| 4 | No Items | ⬜ | |
| 5 | No Taxable Items | ⬜ | |
| 6 | Large Discount | ⬜ | |
| 7 | Stale Cache (THE BUG) | ⬜ | **Most Critical** |
| 8 | Concurrent Item Add | ⬜ | |

---

## Sign-Off

**Tested By**: _________________  
**Date**: _________________  
**Overall Result**: ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

**Ready for Production**: ⬜ YES | ⬜ NO

**Notes**:
```



```

---

## Post-Deployment Monitoring

### Week 1 Checklist
- [ ] Run audit report daily
- [ ] Check for any new tax discrepancies
- [ ] Monitor API error logs for tax calculation failures
- [ ] Verify no performance degradation

### SQL to Monitor Tax Health
```sql
-- Check for any new tax discrepancies (should be ZERO after fix)
SELECT 
  mp.member_program_id,
  mp.program_name,
  mpf.taxes as stored_taxes,
  -- Calculate expected taxes
  (
    (
      SELECT COALESCE(SUM(charge * quantity), 0) 
      FROM member_program_items 
      WHERE member_program_id = mp.member_program_id 
      AND active_flag = true
      AND taxable_flag = true
    ) - 
    (
      ABS(COALESCE(mpf.discounts, 0)) * 
      (
        SELECT COALESCE(SUM(charge * quantity), 0) 
        FROM member_program_items 
        WHERE member_program_id = mp.member_program_id 
        AND active_flag = true
        AND taxable_flag = true
      ) / 
      NULLIF(
        (
          SELECT COALESCE(SUM(charge * quantity), 0) 
          FROM member_program_items 
          WHERE member_program_id = mp.member_program_id 
          AND active_flag = true
        ), 0
      )
    )
  ) * 0.0825 as calculated_taxes,
  ABS(mpf.taxes - (
    (
      SELECT COALESCE(SUM(charge * quantity), 0) 
      FROM member_program_items 
      WHERE member_program_id = mp.member_program_id 
      AND active_flag = true
      AND taxable_flag = true
    ) - 
    (
      ABS(COALESCE(mpf.discounts, 0)) * 
      (
        SELECT COALESCE(SUM(charge * quantity), 0) 
        FROM member_program_items 
        WHERE member_program_id = mp.member_program_id 
        AND active_flag = true
        AND taxable_flag = true
      ) / 
      NULLIF(
        (
          SELECT COALESCE(SUM(charge * quantity), 0) 
          FROM member_program_items 
          WHERE member_program_id = mp.member_program_id 
          AND active_flag = true
        ), 0
      )
    )
  ) * 0.0825) as tax_diff
FROM member_programs mp
JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
HAVING ABS(tax_diff) > 0.01
ORDER BY tax_diff DESC;
```


