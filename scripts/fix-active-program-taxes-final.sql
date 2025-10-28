-- ============================================================================
-- FIX TAXES FOR 31 ACTIVE PROGRAMS
-- ============================================================================
-- Date: October 27, 2025
-- Purpose: Recalculate taxes and discount for Active programs to report
--          correct tax amounts while preserving locked_price and 
--          contracted_at_margin.
--
-- Formula: locked_price = items + taxes + fc + discount - variance
-- 
-- Programs to fix: 31 Active programs with variance = 0
-- Programs excluded:
--   - Barbara Haverstock (#46): Would require positive discount
--   - Neni Navarrete (#27): Already correct (has variance)
--   - Pam Stewart (#34): Already correct (has variance)
--
-- SAFE because:
-- 1. Full backup created first
-- 2. Only updates discount and taxes (NOT locked values)
-- 3. Uses algebraic formula to handle circular dependency
-- 4. Locked price and contracted margin preserved
-- ============================================================================

-- ============================================================================
-- STEP 1: PREVIEW - See what will change (READ ONLY)
-- ============================================================================
WITH item_totals AS (
  SELECT 
    mpi.member_program_id,
    COALESCE(SUM(mpi.item_charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(CASE WHEN t.taxable THEN mpi.item_charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge
  FROM member_program_items mpi
  LEFT JOIN therapies t ON mpi.therapy_id = t.therapy_id
  WHERE mpi.active_flag = true
  GROUP BY mpi.member_program_id
),
active_programs AS (
  SELECT 
    mp.member_program_id,
    l.first_name || ' ' || l.last_name as member_name,
    ps.status_name,
    it.total_charge,
    it.total_taxable_charge,
    mpf.final_total_price as locked_price,
    mpf.finance_charges,
    mpf.discounts as current_discount,
    mpf.taxes as current_taxes,
    COALESCE(mpf.variance, 0) as variance,
    mpf.contracted_at_margin,
    
    CASE 
      WHEN it.total_charge > 0 
      THEN it.total_taxable_charge / it.total_charge 
      ELSE 0 
    END as taxable_percentage
    
  FROM member_programs mp
  JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  JOIN program_status ps ON mp.program_status_id = ps.program_status_id
  JOIN leads l ON mp.lead_id = l.lead_id
  LEFT JOIN item_totals it ON mp.member_program_id = it.member_program_id
  WHERE LOWER(ps.status_name) = 'active'
    AND mpf.final_total_price IS NOT NULL
    AND it.total_charge IS NOT NULL
    AND mp.member_program_id NOT IN (46, 27, 34) -- Exclude outliers
    AND ABS(COALESCE(mpf.variance, 0)) < 0.01 -- Only zero variance
),
calculated AS (
  SELECT 
    member_program_id,
    member_name,
    status_name,
    total_charge,
    total_taxable_charge,
    locked_price,
    COALESCE(finance_charges, 0) as finance_charges,
    current_discount,
    current_taxes,
    variance,
    taxable_percentage,
    contracted_at_margin,
    
    -- NEW DISCOUNT using algebraic formula (accounts for circular dependency)
    -- Formula: discount = (locked + variance - items - taxable×0.0825 - fc) / (1 + taxable_pct×0.0825)
    CASE 
      WHEN (1 + taxable_percentage * 0.0825) > 0
      THEN (locked_price + variance - total_charge - total_taxable_charge * 0.0825 - COALESCE(finance_charges, 0)) 
           / (1 + taxable_percentage * 0.0825)
      ELSE 0
    END as new_discount,
    
    -- NEW TAXES based on new discount
    -- Formula: taxes = (taxable + discount × taxable_pct) × 0.0825
    CASE 
      WHEN (1 + taxable_percentage * 0.0825) > 0
      THEN (total_taxable_charge + 
            ((locked_price + variance - total_charge - total_taxable_charge * 0.0825 - COALESCE(finance_charges, 0)) 
             / (1 + taxable_percentage * 0.0825)) * taxable_percentage) * 0.0825
      ELSE 0
    END as new_taxes
    
  FROM active_programs
),
verification AS (
  SELECT 
    *,
    -- VERIFY: Does locked_price = items + new_taxes + fc + new_discount - variance?
    ROUND((total_charge + new_taxes + finance_charges + new_discount - variance)::numeric, 2) as verified_locked_price,
    
    -- VERIFY: Are new_taxes correct based on new_discount?
    ROUND(((total_taxable_charge + new_discount * taxable_percentage) * 0.0825)::numeric, 2) as verified_taxes,
    
    -- Status check
    CASE 
      WHEN new_discount > 0 THEN '❌ POSITIVE (INVALID)'
      WHEN ABS(new_discount - current_discount) < 0.01 THEN '⚪ NO CHANGE NEEDED'
      ELSE '✅ OK (NEGATIVE)'
    END as discount_status
    
  FROM calculated
)
SELECT 
  member_program_id,
  member_name,
  ROUND(locked_price::numeric, 2) as locked_price,
  ROUND(contracted_at_margin::numeric, 2) as locked_margin,
  '---CURRENT---' as sep1,
  ROUND(current_discount::numeric, 2) as cur_disc,
  ROUND(current_taxes::numeric, 2) as cur_tax,
  '---NEW---' as sep2,
  ROUND(new_discount::numeric, 2) as new_disc,
  ROUND(new_taxes::numeric, 2) as new_tax,
  '---CHANGES---' as sep3,
  ROUND((new_discount - current_discount)::numeric, 2) as disc_change,
  ROUND((new_taxes - current_taxes)::numeric, 2) as tax_change,
  discount_status,
  '---VERIFICATION---' as sep4,
  ROUND(verified_locked_price::numeric, 2) as verify_price,
  CASE 
    WHEN ABS(verified_locked_price - locked_price) < 0.01 
     AND ABS(verified_taxes - new_taxes) < 0.01
    THEN '✅ MATH WORKS'
    ELSE '❌ MATH BROKEN'
  END as math_check
FROM verification
ORDER BY 
  CASE discount_status
    WHEN '❌ POSITIVE (INVALID)' THEN 1
    WHEN '⚪ NO CHANGE NEEDED' THEN 3
    ELSE 2
  END,
  ABS(new_taxes - current_taxes) DESC;

-- STOP HERE! Review the preview above.
-- Questions to verify:
-- 1. Are all 31 programs showing "✅ MATH WORKS"?
-- 2. Are all discount_status showing "✅ OK (NEGATIVE)" or "⚪ NO CHANGE NEEDED"?
-- 3. Are locked_price and locked_margin values correct?
-- 4. Do the tax_change values look reasonable?
-- 
-- If everything looks good, proceed to Step 2.

-- ============================================================================
-- STEP 2: CREATE BACKUP (CRITICAL - DO NOT SKIP!)
-- ============================================================================
/*
CREATE TABLE IF NOT EXISTS member_program_finances_backup_active_tax_fix AS
SELECT * FROM member_program_finances;

-- Verify backup created
SELECT COUNT(*) as backup_row_count, NOW() as backup_time
FROM member_program_finances_backup_active_tax_fix;

-- Verify we have the 31 programs we're about to fix
SELECT COUNT(*) as programs_to_fix
FROM member_program_finances mpf
JOIN member_programs mp ON mpf.member_program_id = mp.member_program_id
JOIN program_status ps ON mp.program_status_id = ps.program_status_id
WHERE LOWER(ps.status_name) = 'active'
  AND mp.member_program_id NOT IN (46, 27, 34)
  AND ABS(COALESCE(mpf.variance, 0)) < 0.01;
*/

-- ============================================================================
-- STEP 3: UPDATE THE 31 PROGRAMS
-- ============================================================================
/*
WITH item_totals AS (
  SELECT 
    mpi.member_program_id,
    COALESCE(SUM(mpi.item_charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(CASE WHEN t.taxable THEN mpi.item_charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge
  FROM member_program_items mpi
  LEFT JOIN therapies t ON mpi.therapy_id = t.therapy_id
  WHERE mpi.active_flag = true
  GROUP BY mpi.member_program_id
),
active_programs AS (
  SELECT 
    mp.member_program_id,
    it.total_charge,
    it.total_taxable_charge,
    mpf.final_total_price as locked_price,
    mpf.finance_charges,
    COALESCE(mpf.variance, 0) as variance,
    
    CASE 
      WHEN it.total_charge > 0 
      THEN it.total_taxable_charge / it.total_charge 
      ELSE 0 
    END as taxable_percentage
    
  FROM member_programs mp
  JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  JOIN program_status ps ON mp.program_status_id = ps.program_status_id
  LEFT JOIN item_totals it ON mp.member_program_id = it.member_program_id
  WHERE LOWER(ps.status_name) = 'active'
    AND mpf.final_total_price IS NOT NULL
    AND it.total_charge IS NOT NULL
    AND mp.member_program_id NOT IN (46, 27, 34)
    AND ABS(COALESCE(mpf.variance, 0)) < 0.01
),
calculated AS (
  SELECT 
    member_program_id,
    
    -- NEW DISCOUNT
    CASE 
      WHEN (1 + taxable_percentage * 0.0825) > 0
      THEN (locked_price + variance - total_charge - total_taxable_charge * 0.0825 - COALESCE(finance_charges, 0)) 
           / (1 + taxable_percentage * 0.0825)
      ELSE 0
    END as new_discount,
    
    -- NEW TAXES
    CASE 
      WHEN (1 + taxable_percentage * 0.0825) > 0
      THEN (total_taxable_charge + 
            ((locked_price + variance - total_charge - total_taxable_charge * 0.0825 - COALESCE(finance_charges, 0)) 
             / (1 + taxable_percentage * 0.0825)) * taxable_percentage) * 0.0825
      ELSE 0
    END as new_taxes
    
  FROM active_programs
)
UPDATE member_program_finances mpf
SET 
  discounts = c.new_discount,
  taxes = c.new_taxes,
  updated_at = NOW()
  -- NOTE: We do NOT update:
  --   - final_total_price (LOCKED)
  --   - contracted_at_margin (LOCKED)
  --   - variance (stays as-is, not part of this fix)
FROM calculated c
WHERE mpf.member_program_id = c.member_program_id;

-- Show results
SELECT COUNT(*) as programs_updated FROM member_program_finances
WHERE updated_at > NOW() - INTERVAL '10 seconds';
*/

-- ============================================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================================

-- 4A: Verify no remaining tax discrepancies for the 31 programs
/*
WITH item_totals AS (
  SELECT 
    mpi.member_program_id,
    COALESCE(SUM(mpi.item_charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(CASE WHEN t.taxable THEN mpi.item_charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge
  FROM member_program_items mpi
  LEFT JOIN therapies t ON mpi.therapy_id = t.therapy_id
  WHERE mpi.active_flag = true
  GROUP BY mpi.member_program_id
),
calculated AS (
  SELECT 
    mp.member_program_id,
    l.first_name || ' ' || l.last_name as member_name,
    mpf.taxes as stored_taxes,
    mpf.discounts,
    it.total_taxable_charge,
    it.total_charge,
    
    -- Calculate what taxes SHOULD be
    CASE 
      WHEN it.total_charge > 0 
      THEN (it.total_taxable_charge + mpf.discounts * (it.total_taxable_charge / it.total_charge)) * 0.0825
      ELSE 0
    END as correct_taxes
    
  FROM member_programs mp
  JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  JOIN program_status ps ON mp.program_status_id = ps.program_status_id
  JOIN leads l ON mp.lead_id = l.lead_id
  LEFT JOIN item_totals it ON mp.member_program_id = it.member_program_id
  WHERE LOWER(ps.status_name) = 'active'
    AND mp.member_program_id NOT IN (46, 27, 34)
    AND mpf.updated_at > NOW() - INTERVAL '1 hour'
)
SELECT 
  member_program_id,
  member_name,
  ROUND(stored_taxes::numeric, 2) as stored_taxes,
  ROUND(correct_taxes::numeric, 2) as correct_taxes,
  ROUND((correct_taxes - stored_taxes)::numeric, 2) as remaining_diff
FROM calculated
WHERE ABS(correct_taxes - stored_taxes) > 0.01
ORDER BY ABS(correct_taxes - stored_taxes) DESC;

-- Expected: ZERO rows (no discrepancies)
*/

-- 4B: Verify locked values were NOT changed
/*
SELECT 
  mpf.member_program_id,
  l.first_name || ' ' || l.last_name as member_name,
  mpf.final_total_price as current_locked_price,
  bkp.final_total_price as backup_locked_price,
  mpf.contracted_at_margin as current_locked_margin,
  bkp.contracted_at_margin as backup_locked_margin,
  CASE 
    WHEN mpf.final_total_price = bkp.final_total_price 
     AND mpf.contracted_at_margin = bkp.contracted_at_margin 
    THEN '✅ LOCKED VALUES PRESERVED'
    ELSE '❌ LOCKED VALUES CHANGED!!!'
  END as verification
FROM member_program_finances mpf
JOIN member_programs mp ON mpf.member_program_id = mp.member_program_id
JOIN program_status ps ON mp.program_status_id = ps.program_status_id
JOIN leads l ON mp.lead_id = l.lead_id
JOIN member_program_finances_backup_active_tax_fix bkp ON mpf.member_program_id = bkp.member_program_id
WHERE LOWER(ps.status_name) = 'active'
  AND mp.member_program_id NOT IN (46, 27, 34)
  AND mpf.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY mpf.member_program_id;

-- Expected: All rows show "✅ LOCKED VALUES PRESERVED"
*/

-- 4C: Summary of changes
/*
SELECT 
  COUNT(*) as programs_updated,
  ROUND(AVG(mpf.taxes - bkp.taxes)::numeric, 2) as avg_tax_change,
  ROUND(MIN(mpf.taxes - bkp.taxes)::numeric, 2) as min_tax_change,
  ROUND(MAX(mpf.taxes - bkp.taxes)::numeric, 2) as max_tax_change,
  ROUND(AVG(mpf.discounts - bkp.discounts)::numeric, 2) as avg_discount_change,
  ROUND(MIN(mpf.discounts - bkp.discounts)::numeric, 2) as min_discount_change,
  ROUND(MAX(mpf.discounts - bkp.discounts)::numeric, 2) as max_discount_change
FROM member_program_finances mpf
JOIN member_programs mp ON mpf.member_program_id = mp.member_program_id
JOIN program_status ps ON mp.program_status_id = ps.program_status_id
JOIN member_program_finances_backup_active_tax_fix bkp ON mpf.member_program_id = bkp.member_program_id
WHERE LOWER(ps.status_name) = 'active'
  AND mp.member_program_id NOT IN (46, 27, 34)
  AND mpf.updated_at > NOW() - INTERVAL '1 hour';
*/

-- ============================================================================
-- STEP 5: ROLLBACK (ONLY IF SOMETHING WENT WRONG!)
-- ============================================================================
/*
-- WARNING: This will restore ALL finance data to backup state
UPDATE member_program_finances mpf
SET 
  taxes = bkp.taxes,
  discounts = bkp.discounts,
  margin = bkp.margin,
  variance = bkp.variance,
  final_total_price = bkp.final_total_price,
  contracted_at_margin = bkp.contracted_at_margin,
  updated_at = bkp.updated_at
FROM member_program_finances_backup_active_tax_fix bkp
WHERE mpf.member_program_id = bkp.member_program_id
  AND mpf.member_program_id IN (
    SELECT mp.member_program_id 
    FROM member_programs mp
    JOIN program_status ps ON mp.program_status_id = ps.program_status_id
    WHERE LOWER(ps.status_name) = 'active'
      AND mp.member_program_id NOT IN (46, 27, 34)
  );

SELECT 'Rollback complete for 31 programs' as status;
*/

-- ============================================================================
-- EXECUTION CHECKLIST
-- ============================================================================
-- [ ] 1. Run Step 1 (Preview) - Review output carefully
-- [ ] 2. Verify all 31 programs show "✅ MATH WORKS"
-- [ ] 3. Verify no "❌ POSITIVE (INVALID)" discount status
-- [ ] 4. Run Step 2 (Backup) - CRITICAL: Don't skip this!
-- [ ] 5. Run Step 3 (Update) - Fix the 31 programs
-- [ ] 6. Run Step 4A (Verify no remaining discrepancies)
-- [ ] 7. Run Step 4B (Verify locked values preserved)
-- [ ] 8. Run Step 4C (Summary of changes)
-- [ ] 9. Check application audit report (should show LESS issues)
-- [ ] 10. Document Barbara (#46) for manual review

-- ============================================================================
-- NOTES
-- ============================================================================
-- Programs Excluded (3 total):
--   1. Barbara Haverstock (#46): Would require positive discount (customer 
--      would owe more). Needs manual review.
--   2. Neni Navarrete (#27): Has variance = -$56.99. Already correct.
--   3. Pam Stewart (#34): Has variance = -$30.84. Already correct.
--
-- Programs Fixed (31 total):
--   All Active programs with variance = 0 where taxes need correction.
--
-- The Fix:
--   - Adjusts discount by slightly more negative amount
--   - Recalculates taxes based on new discount
--   - Locked price stays exactly the same
--   - Customer payment unchanged
--   - You report correct taxes for sales tax purposes
--
-- Formula Used:
--   locked_price = items + taxes + fc + discount - variance
--   
--   Solving for discount and taxes simultaneously:
--   discount = (locked + variance - items - taxable×0.0825 - fc) / (1 + taxable_pct×0.0825)
--   taxes = (taxable + discount × taxable_pct) × 0.0825
--
-- ============================================================================

