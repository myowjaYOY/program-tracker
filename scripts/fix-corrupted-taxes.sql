-- ============================================================================
-- FIX CORRUPTED TAXES IN member_program_finances
-- ============================================================================
-- Date: October 27, 2025
-- Purpose: Recalculate and update incorrect taxes WITHOUT impacting:
--          - contracted_at_margin (LOCKED for Active programs)
--          - final_total_price (LOCKED for Active programs)
--
-- SAFE because:
-- 1. Only updates taxes field
-- 2. Uses same proven calculation logic as API
-- 3. Respects locked values for Active programs
-- 4. Recalculates dependent fields (variance, margin) correctly
-- ============================================================================

-- Step 1: Preview what will change (RUN THIS FIRST!)
-- ============================================================================
WITH item_totals AS (
  SELECT 
    mpi.member_program_id,
    COALESCE(SUM(mpi.charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(CASE WHEN mpi.taxable_flag THEN mpi.charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge
  FROM member_program_items mpi
  WHERE mpi.active_flag = true
  GROUP BY mpi.member_program_id
),
calculated AS (
  SELECT 
    mp.member_program_id,
    mp.program_name,
    ps.status_name,
    it.total_charge,
    it.total_taxable_charge,
    mpf.discounts,
    mpf.taxes as current_stored_taxes,
    mpf.contracted_at_margin,
    mpf.final_total_price,
    
    -- Calculate correct taxes using the proven formula
    CASE 
      WHEN it.total_charge <= 0 OR it.total_taxable_charge <= 0 THEN 0
      ELSE (
        it.total_taxable_charge - 
        (ABS(COALESCE(mpf.discounts, 0)) * (it.total_taxable_charge / NULLIF(it.total_charge, 0)))
      ) * 0.0825
    END as correct_taxes,
    
    -- For reference: what is the total cost?
    (SELECT COALESCE(SUM(cost * quantity), 0) 
     FROM member_program_items 
     WHERE member_program_id = mp.member_program_id AND active_flag = true) as total_cost
    
  FROM member_programs mp
  JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  JOIN program_status ps ON mp.program_status_id = ps.program_status_id
  LEFT JOIN item_totals it ON mp.member_program_id = it.member_program_id
)
SELECT 
  member_program_id,
  program_name,
  status_name,
  ROUND(current_stored_taxes::numeric, 2) as stored_taxes,
  ROUND(correct_taxes::numeric, 2) as correct_taxes,
  ROUND((correct_taxes - current_stored_taxes)::numeric, 2) as tax_difference,
  ROUND(total_charge::numeric, 2) as total_charge,
  ROUND(total_taxable_charge::numeric, 2) as total_taxable_charge,
  ROUND(COALESCE(discounts, 0)::numeric, 2) as discounts,
  ROUND(COALESCE(contracted_at_margin, 0)::numeric, 2) as locked_margin,
  ROUND(COALESCE(final_total_price, 0)::numeric, 2) as locked_price
FROM calculated
WHERE ABS(correct_taxes - current_stored_taxes) > 0.01  -- Only show discrepancies > 1 cent
ORDER BY ABS(correct_taxes - current_stored_taxes) DESC;

-- STOP HERE! Review the preview above.
-- Questions to verify:
-- 1. Are the correct_taxes values reasonable?
-- 2. Do you see programs that should be fixed?
-- 3. Are locked_margin and locked_price values present for Active programs?
-- 
-- If everything looks good, proceed to Step 2.

-- ============================================================================
-- Step 2: Create backup of current data (CRITICAL!)
-- ============================================================================
-- Uncomment and run this before making any changes:

/*
CREATE TABLE IF NOT EXISTS member_program_finances_backup_20251027 AS
SELECT * FROM member_program_finances;

-- Verify backup created
SELECT COUNT(*) as backup_row_count FROM member_program_finances_backup_20251027;
*/

-- ============================================================================
-- Step 3A: Fix Quote Programs (Simple - nothing is locked)
-- ============================================================================
-- For Quote programs, we can recalculate everything safely

/*
WITH item_totals AS (
  SELECT 
    mpi.member_program_id,
    COALESCE(SUM(mpi.charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(mpi.cost * mpi.quantity), 0) as total_cost,
    COALESCE(SUM(CASE WHEN mpi.taxable_flag THEN mpi.charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge
  FROM member_program_items mpi
  WHERE mpi.active_flag = true
  GROUP BY mpi.member_program_id
),
calculated AS (
  SELECT 
    mp.member_program_id,
    it.total_charge,
    it.total_cost,
    it.total_taxable_charge,
    mpf.discounts,
    mpf.finance_charges,
    
    -- Calculate correct taxes
    CASE 
      WHEN it.total_charge <= 0 OR it.total_taxable_charge <= 0 THEN 0
      ELSE (
        it.total_taxable_charge - 
        (ABS(COALESCE(mpf.discounts, 0)) * (it.total_taxable_charge / NULLIF(it.total_charge, 0)))
      ) * 0.0825
    END as correct_taxes
    
  FROM member_programs mp
  JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  JOIN program_status ps ON mp.program_status_id = ps.program_status_id
  LEFT JOIN item_totals it ON mp.member_program_id = it.member_program_id
  WHERE LOWER(ps.status_name) = 'quote'  -- Only Quote programs
)
UPDATE member_program_finances mpf
SET 
  taxes = c.correct_taxes,
  -- Also recalculate margin and final_total_price for Quote programs
  margin = CASE 
    WHEN (c.total_charge + c.correct_taxes + COALESCE(c.finance_charges, 0) - ABS(COALESCE(c.discounts, 0))) > 0 
    THEN ((c.total_charge + c.correct_taxes + COALESCE(c.finance_charges, 0) - ABS(COALESCE(c.discounts, 0)) - c.total_cost) / 
          (c.total_charge + c.correct_taxes + COALESCE(c.finance_charges, 0) - ABS(COALESCE(c.discounts, 0)))) * 100
    ELSE 0
  END,
  final_total_price = c.total_charge + c.correct_taxes + COALESCE(c.finance_charges, 0) - ABS(COALESCE(c.discounts, 0)),
  updated_at = NOW()
FROM calculated c
WHERE mpf.member_program_id = c.member_program_id
  AND ABS(mpf.taxes - c.correct_taxes) > 0.01;  -- Only update if taxes are wrong

-- Check results
SELECT COUNT(*) as quote_programs_fixed FROM member_program_finances mpf
JOIN member_programs mp ON mpf.member_program_id = mp.member_program_id
JOIN program_status ps ON mp.program_status_id = ps.program_status_id
WHERE LOWER(ps.status_name) = 'quote' AND mpf.updated_at > NOW() - INTERVAL '5 minutes';
*/

-- ============================================================================
-- Step 3B: Fix Active Programs (Complex - respect locked values)
-- ============================================================================
-- For Active programs:
-- - contracted_at_margin is LOCKED (don't recalculate)
-- - final_total_price is LOCKED (don't recalculate)
-- - taxes CAN be updated (it's flexible to allow item changes)
-- - variance and margin need to be recalculated based on locked price

/*
WITH item_totals AS (
  SELECT 
    mpi.member_program_id,
    COALESCE(SUM(mpi.charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(mpi.cost * mpi.quantity), 0) as total_cost,
    COALESCE(SUM(CASE WHEN mpi.taxable_flag THEN mpi.charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge
  FROM member_program_items mpi
  WHERE mpi.active_flag = true
  GROUP BY mpi.member_program_id
),
calculated AS (
  SELECT 
    mp.member_program_id,
    it.total_charge,
    it.total_cost,
    it.total_taxable_charge,
    mpf.discounts,
    mpf.finance_charges,
    mpf.final_total_price as locked_price,  -- DON'T CHANGE THIS
    mpf.contracted_at_margin as locked_margin,  -- DON'T CHANGE THIS
    
    -- Calculate correct taxes
    CASE 
      WHEN it.total_charge <= 0 OR it.total_taxable_charge <= 0 THEN 0
      ELSE (
        it.total_taxable_charge - 
        (ABS(COALESCE(mpf.discounts, 0)) * (it.total_taxable_charge / NULLIF(it.total_charge, 0)))
      ) * 0.0825
    END as correct_taxes
    
  FROM member_programs mp
  JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  JOIN program_status ps ON mp.program_status_id = ps.program_status_id
  LEFT JOIN item_totals it ON mp.member_program_id = it.member_program_id
  WHERE LOWER(ps.status_name) = 'active'  -- Only Active programs
),
recalculated AS (
  SELECT
    member_program_id,
    correct_taxes,
    locked_price,
    locked_margin,
    total_cost,
    
    -- Calculate projected price (what it WOULD be without lock)
    total_charge + correct_taxes + COALESCE(finance_charges, 0) - ABS(COALESCE(discounts, 0)) as projected_price,
    
    -- Calculate variance: projected - locked
    (total_charge + correct_taxes + COALESCE(finance_charges, 0) - ABS(COALESCE(discounts, 0))) - locked_price as variance,
    
    -- Calculate margin on locked price (this is what shows actual profitability)
    CASE 
      WHEN locked_price > 0 
      THEN ((locked_price - total_cost) / locked_price) * 100
      ELSE 0
    END as margin_on_locked_price
    
  FROM calculated
)
UPDATE member_program_finances mpf
SET 
  taxes = r.correct_taxes,  -- Fix the taxes
  variance = r.variance,    -- Update variance to reflect new taxes
  margin = r.margin_on_locked_price,  -- Recalculate margin on locked price
  -- DO NOT UPDATE: contracted_at_margin (stays locked)
  -- DO NOT UPDATE: final_total_price (stays locked)
  updated_at = NOW()
FROM recalculated r
WHERE mpf.member_program_id = r.member_program_id
  AND ABS(mpf.taxes - r.correct_taxes) > 0.01;  -- Only update if taxes are wrong

-- Check results
SELECT COUNT(*) as active_programs_fixed FROM member_program_finances mpf
JOIN member_programs mp ON mpf.member_program_id = mp.member_program_id
JOIN program_status ps ON mp.program_status_id = ps.program_status_id
WHERE LOWER(ps.status_name) = 'active' AND mpf.updated_at > NOW() - INTERVAL '5 minutes';
*/

-- ============================================================================
-- Step 3C: Fix Other Status Programs (Paused, Completed, etc.)
-- ============================================================================
-- These are also locked like Active programs

/*
WITH item_totals AS (
  SELECT 
    mpi.member_program_id,
    COALESCE(SUM(mpi.charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(mpi.cost * mpi.quantity), 0) as total_cost,
    COALESCE(SUM(CASE WHEN mpi.taxable_flag THEN mpi.charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge
  FROM member_program_items mpi
  WHERE mpi.active_flag = true
  GROUP BY mpi.member_program_id
),
calculated AS (
  SELECT 
    mp.member_program_id,
    it.total_charge,
    it.total_cost,
    it.total_taxable_charge,
    mpf.discounts,
    mpf.finance_charges,
    mpf.final_total_price as locked_price,
    mpf.contracted_at_margin as locked_margin,
    
    CASE 
      WHEN it.total_charge <= 0 OR it.total_taxable_charge <= 0 THEN 0
      ELSE (
        it.total_taxable_charge - 
        (ABS(COALESCE(mpf.discounts, 0)) * (it.total_taxable_charge / NULLIF(it.total_charge, 0)))
      ) * 0.0825
    END as correct_taxes
    
  FROM member_programs mp
  JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  JOIN program_status ps ON mp.program_status_id = ps.program_status_id
  LEFT JOIN item_totals it ON mp.member_program_id = it.member_program_id
  WHERE LOWER(ps.status_name) NOT IN ('quote', 'active')  -- All other statuses
),
recalculated AS (
  SELECT
    member_program_id,
    correct_taxes,
    locked_price,
    locked_margin,
    total_cost,
    (total_charge + correct_taxes + COALESCE(finance_charges, 0) - ABS(COALESCE(discounts, 0))) - locked_price as variance,
    CASE 
      WHEN locked_price > 0 
      THEN ((locked_price - total_cost) / locked_price) * 100
      ELSE 0
    END as margin_on_locked_price
  FROM calculated
)
UPDATE member_program_finances mpf
SET 
  taxes = r.correct_taxes,
  variance = r.variance,
  margin = r.margin_on_locked_price,
  updated_at = NOW()
FROM recalculated r
WHERE mpf.member_program_id = r.member_program_id
  AND ABS(mpf.taxes - r.correct_taxes) > 0.01;

-- Check results
SELECT COUNT(*) as other_programs_fixed FROM member_program_finances mpf
JOIN member_programs mp ON mpf.member_program_id = mp.member_program_id
JOIN program_status ps ON mp.program_status_id = ps.program_status_id
WHERE LOWER(ps.status_name) NOT IN ('quote', 'active') 
  AND mpf.updated_at > NOW() - INTERVAL '5 minutes';
*/

-- ============================================================================
-- Step 4: Verification Queries
-- ============================================================================
-- Run these after the fix to verify success

-- 4A: Check for remaining tax discrepancies (should be ZERO or very small)
/*
WITH item_totals AS (
  SELECT 
    mpi.member_program_id,
    COALESCE(SUM(mpi.charge * mpi.quantity), 0) as total_charge,
    COALESCE(SUM(CASE WHEN mpi.taxable_flag THEN mpi.charge * mpi.quantity ELSE 0 END), 0) as total_taxable_charge
  FROM member_program_items mpi
  WHERE mpi.active_flag = true
  GROUP BY mpi.member_program_id
),
calculated AS (
  SELECT 
    mp.member_program_id,
    mp.program_name,
    ps.status_name,
    mpf.taxes as stored_taxes,
    CASE 
      WHEN it.total_charge <= 0 OR it.total_taxable_charge <= 0 THEN 0
      ELSE (
        it.total_taxable_charge - 
        (ABS(COALESCE(mpf.discounts, 0)) * (it.total_taxable_charge / NULLIF(it.total_charge, 0)))
      ) * 0.0825
    END as correct_taxes
  FROM member_programs mp
  JOIN member_program_finances mpf ON mp.member_program_id = mpf.member_program_id
  JOIN program_status ps ON mp.program_status_id = ps.program_status_id
  LEFT JOIN item_totals it ON mp.member_program_id = it.member_program_id
)
SELECT 
  member_program_id,
  program_name,
  status_name,
  ROUND(stored_taxes::numeric, 2) as stored_taxes,
  ROUND(correct_taxes::numeric, 2) as correct_taxes,
  ROUND((correct_taxes - stored_taxes)::numeric, 2) as remaining_diff
FROM calculated
WHERE ABS(correct_taxes - stored_taxes) > 0.01
ORDER BY ABS(correct_taxes - stored_taxes) DESC;
*/

-- 4B: Verify locked values were NOT changed for Active programs
/*
SELECT 
  mpf.member_program_id,
  mp.program_name,
  mpf.contracted_at_margin as current_locked_margin,
  bkp.contracted_at_margin as backup_locked_margin,
  mpf.final_total_price as current_locked_price,
  bkp.final_total_price as backup_locked_price,
  CASE 
    WHEN mpf.contracted_at_margin = bkp.contracted_at_margin 
     AND mpf.final_total_price = bkp.final_total_price 
    THEN '✅ LOCKED VALUES PRESERVED'
    ELSE '❌ LOCKED VALUES CHANGED!!!'
  END as verification
FROM member_program_finances mpf
JOIN member_programs mp ON mpf.member_program_id = mp.member_program_id
JOIN program_status ps ON mp.program_status_id = ps.program_status_id
JOIN member_program_finances_backup_20251027 bkp ON mpf.member_program_id = bkp.member_program_id
WHERE LOWER(ps.status_name) = 'active'
  AND mpf.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY mpf.member_program_id;
*/

-- 4C: Summary of changes made
/*
SELECT 
  ps.status_name,
  COUNT(*) as programs_updated,
  ROUND(AVG(mpf.taxes - bkp.taxes)::numeric, 2) as avg_tax_change,
  ROUND(MIN(mpf.taxes - bkp.taxes)::numeric, 2) as min_tax_change,
  ROUND(MAX(mpf.taxes - bkp.taxes)::numeric, 2) as max_tax_change
FROM member_program_finances mpf
JOIN member_programs mp ON mpf.member_program_id = mp.member_program_id
JOIN program_status ps ON mp.program_status_id = ps.program_status_id
JOIN member_program_finances_backup_20251027 bkp ON mpf.member_program_id = bkp.member_program_id
WHERE mpf.updated_at > NOW() - INTERVAL '1 hour'
GROUP BY ps.status_name
ORDER BY ps.status_name;
*/

-- ============================================================================
-- Step 5: Rollback (ONLY IF SOMETHING WENT WRONG!)
-- ============================================================================
-- If you need to undo the changes:

/*
-- WARNING: This will restore ALL data to backup state
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

SELECT 'Rollback complete' as status;
*/

-- ============================================================================
-- EXECUTION CHECKLIST
-- ============================================================================
-- [ ] 1. Run Step 1 (Preview) - Review output carefully
-- [ ] 2. Run Step 2 (Backup) - CRITICAL: Don't skip this!
-- [ ] 3. Run Step 3A (Quote Programs) - Review count
-- [ ] 4. Run Step 3B (Active Programs) - Review count
-- [ ] 5. Run Step 3C (Other Programs) - Review count
-- [ ] 6. Run Step 4A (Verify no remaining discrepancies)
-- [ ] 7. Run Step 4B (Verify locked values preserved)
-- [ ] 8. Run Step 4C (Summary of changes)
-- [ ] 9. Run audit report in application
-- [ ] 10. Celebrate! 🎉

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This script is SAFE because it:
--    - Creates backup before making changes
--    - Only updates taxes and dependent calculated fields
--    - Respects locked values (contracted_at_margin, final_total_price)
--    - Has easy rollback mechanism
--
-- 2. The tax calculation formula matches the API exactly:
--    taxablePercentage = totalTaxableCharge / totalCharge
--    taxableDiscount = |discount| × taxablePercentage
--    discountedTaxable = totalTaxableCharge - taxableDiscount
--    taxes = discountedTaxable × 0.0825
--
-- 3. For Active programs:
--    - variance = projectedPrice - lockedPrice
--    - margin = ((lockedPrice - totalCost) / lockedPrice) × 100
--
-- 4. Run during maintenance window if possible (though script is safe)
-- 5. Monitor audit report after completion
-- ============================================================================

