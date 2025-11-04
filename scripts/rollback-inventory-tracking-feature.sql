-- ============================================================================
-- ROLLBACK SCRIPT: Inventory Tracking Feature
-- ============================================================================
-- Purpose: Remove inventory tracking feature changes if needed
-- Date: 2025-11-04
-- 
-- WARNING: This will NOT delete the inventory_items table or existing data.
--          It only removes NEW inventory items created by the feature.
--          Review carefully before executing.
-- ============================================================================

-- Step 1: Identify inventory items created by the new feature
-- (items created after 2025-11-04 00:00:00 UTC)
SELECT 
  ii.inventory_item_id,
  ii.therapy_id,
  t.therapy_name,
  ii.created_at,
  ii.created_by
FROM inventory_items ii
JOIN therapies t ON ii.therapy_id = t.therapy_id
WHERE ii.created_at >= '2025-11-04 00:00:00+00'
ORDER BY ii.created_at DESC;

-- Step 2: ROLLBACK OPTION A - Soft delete (RECOMMENDED)
-- Deactivate inventory items created by the feature
-- This preserves data and is reversible
/*
UPDATE inventory_items
SET 
  active_flag = false,
  updated_at = NOW(),
  updated_by = auth.uid()
WHERE created_at >= '2025-11-04 00:00:00+00';
*/

-- Step 3: ROLLBACK OPTION B - Hard delete (USE WITH CAUTION)
-- Permanently delete inventory items created by the feature
-- Only use if you're absolutely sure!
/*
DELETE FROM inventory_items
WHERE created_at >= '2025-11-04 00:00:00+00'
  AND inventory_item_id NOT IN (
    -- Exclude items referenced in transactions
    SELECT DISTINCT inventory_item_id 
    FROM inventory_transactions
  );
*/

-- Step 4: Verify rollback
-- Check that no active inventory items remain from the feature
SELECT 
  COUNT(*) as active_new_items
FROM inventory_items
WHERE created_at >= '2025-11-04 00:00:00+00'
  AND active_flag = true;

-- Expected result: 0 rows (if rollback successful)

