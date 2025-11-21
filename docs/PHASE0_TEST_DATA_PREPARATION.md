# Phase 0.2: Test Data Preparation

**Purpose:** Create comprehensive test scenarios to validate all aspects of the adaptive schedule implementation.

---

## Test Scenario Overview

We will create **5 test programs** covering different edge cases:

1. **Test Program 1:** Fresh program, no completions (Mode 1 baseline)
2. **Test Program 2:** Partially completed with on-time redemptions
3. **Test Program 3:** Partially completed with LATE redemption (will test manual adjustment)
4. **Test Program 4:** Mixed states (redeemed, missed, pending)
5. **Test Program 5:** Program with pause period

---

## Prerequisites

Before creating test data, identify:
- A test lead/member to use (or create one)
- Active program status ID
- A therapy item suitable for testing (e.g., "Supplement Pickup")
- Therapy ID for the item

**Query to get these values:**

```sql
-- Find a test lead
SELECT lead_id, first_name, last_name, email
FROM leads
WHERE LOWER(email) LIKE '%test%' 
   OR LOWER(last_name) = 'test'
ORDER BY created_at DESC
LIMIT 5;

-- Find Active status
SELECT program_status_id, status_name
FROM program_status
WHERE LOWER(status_name) = 'active';

-- Find a test therapy
SELECT therapy_id, therapy_name, bucket_id
FROM therapies
WHERE therapy_name ILIKE '%supplement%'
   OR therapy_name ILIKE '%test%'
ORDER BY therapy_id
LIMIT 10;
```

**Record these values:**
- `TEST_LEAD_ID`: ___________
- `ACTIVE_STATUS_ID`: ___________
- `TEST_THERAPY_ID`: ___________

---

## Test Scenario 1: Fresh Program (Mode 1 Baseline)

**Purpose:** Verify baseline functionality with no completed instances.

**Expected Behavior:**
- Generate Schedule uses program start date + pause days
- All 6 instances created with correct spacing
- No cascade logic triggered (no completions exist)

```sql
-- Create test program
INSERT INTO member_programs (
  lead_id,
  program_status_id,
  start_date,
  active_flag
) VALUES (
  TEST_LEAD_ID,  -- Replace with actual ID
  ACTIVE_STATUS_ID,  -- Replace with actual ID
  CURRENT_DATE,
  true
) RETURNING member_program_id;
-- Record returned ID as TEST_PROGRAM_1_ID: ___________

-- Add program item: 6 supplements, every 7 days
INSERT INTO member_program_items (
  member_program_id,
  therapy_id,
  quantity,
  item_cost,
  item_charge,
  days_from_start,
  days_between,
  active_flag
) VALUES (
  TEST_PROGRAM_1_ID,  -- Replace with actual ID from above
  TEST_THERAPY_ID,  -- Replace with actual therapy ID
  6,
  0.00,
  50.00,
  0,  -- Start immediately
  7,  -- Every 7 days
  true
) RETURNING member_program_item_id;
-- Record returned ID as TEST_ITEM_1_ID: ___________

-- Generate schedule
SELECT generate_member_program_schedule(TEST_PROGRAM_1_ID);

-- Verify results
SELECT 
  instance_number,
  scheduled_date,
  completed_flag,
  EXTRACT(DOW FROM scheduled_date) as day_of_week  -- Should not be 0 (Sun) or 6 (Sat)
FROM member_program_item_schedule
WHERE member_program_item_id = TEST_ITEM_1_ID
ORDER BY instance_number;
```

**Expected Results:**
- 6 rows created
- Dates are 7 days apart (accounting for weekend shifts)
- All `completed_flag` are NULL
- No dates fall on weekends

---

## Test Scenario 2: Partially Completed (On-Time Redemptions)

**Purpose:** Verify Mode 2 triggers when completions exist, and on-time redemptions don't trigger adjustment prompt.

```sql
-- Create test program
INSERT INTO member_programs (
  lead_id,
  program_status_id,
  start_date,
  active_flag
) VALUES (
  TEST_LEAD_ID,
  ACTIVE_STATUS_ID,
  CURRENT_DATE - INTERVAL '21 days',  -- Started 3 weeks ago
  true
) RETURNING member_program_id;
-- Record as TEST_PROGRAM_2_ID: ___________

-- Add program item
INSERT INTO member_program_items (
  member_program_id,
  therapy_id,
  quantity,
  item_cost,
  item_charge,
  days_from_start,
  days_between,
  active_flag
) VALUES (
  TEST_PROGRAM_2_ID,
  TEST_THERAPY_ID,
  6,
  0.00,
  50.00,
  0,
  7,
  true
) RETURNING member_program_item_id;
-- Record as TEST_ITEM_2_ID: ___________

-- Generate initial schedule
SELECT generate_member_program_schedule(TEST_PROGRAM_2_ID);

-- Mark first 3 instances as redeemed (on their scheduled dates)
UPDATE member_program_item_schedule
SET completed_flag = true
WHERE member_program_item_id = TEST_ITEM_2_ID
  AND instance_number IN (1, 2, 3);

-- Verify current state
SELECT 
  instance_number,
  scheduled_date,
  completed_flag,
  CASE 
    WHEN completed_flag = TRUE THEN 'Redeemed ✅'
    WHEN completed_flag = FALSE THEN 'Missed ❌'
    WHEN completed_flag IS NULL THEN 'Pending ⭕'
  END as status
FROM member_program_item_schedule
WHERE member_program_item_id = TEST_ITEM_2_ID
ORDER BY instance_number;

-- NOW TEST: Regenerate schedule (simulate adding a new item)
SELECT generate_member_program_schedule(TEST_PROGRAM_2_ID);

-- Verify Mode 2 was used
SELECT 
  instance_number,
  scheduled_date,
  completed_flag,
  CASE 
    WHEN completed_flag = TRUE THEN 'Redeemed ✅'
    WHEN completed_flag = FALSE THEN 'Missed ❌'
    WHEN completed_flag IS NULL THEN 'Pending ⭕'
  END as status
FROM member_program_item_schedule
WHERE member_program_item_id = TEST_ITEM_2_ID
ORDER BY instance_number;
```

**Expected Results (After Regeneration):**
- Instances 1-3: Still marked as redeemed with original dates ✅
- Instances 4-6: Regenerated from instance 3's scheduled_date + 7 days each
- No dates changed because no manual adjustments were made

---

## Test Scenario 3: Late Redemption (Manual Adjustment Test)

**Purpose:** Test the core use case - late redemption with schedule adjustment.

**This scenario will be tested AFTER implementing the UI modal (Phase 6), but we prepare the data now.**

```sql
-- Create test program
INSERT INTO member_programs (
  lead_id,
  program_status_id,
  start_date,
  active_flag
) VALUES (
  TEST_LEAD_ID,
  ACTIVE_STATUS_ID,
  CURRENT_DATE - INTERVAL '28 days',  -- Started 4 weeks ago
  true
) RETURNING member_program_id;
-- Record as TEST_PROGRAM_3_ID: ___________

-- Add program item
INSERT INTO member_program_items (
  member_program_id,
  therapy_id,
  quantity,
  item_cost,
  item_charge,
  days_from_start,
  days_between,
  active_flag
) VALUES (
  TEST_PROGRAM_3_ID,
  TEST_THERAPY_ID,
  6,
  0.00,
  50.00,
  0,
  7,
  true
) RETURNING member_program_item_id;
-- Record as TEST_ITEM_3_ID: ___________

-- Generate schedule
SELECT generate_member_program_schedule(TEST_PROGRAM_3_ID);

-- Mark instances 1-3 as redeemed on time
UPDATE member_program_item_schedule
SET completed_flag = true
WHERE member_program_item_id = TEST_ITEM_3_ID
  AND instance_number IN (1, 2, 3);

-- View current schedule
SELECT 
  instance_number,
  scheduled_date,
  completed_flag
FROM member_program_item_schedule
WHERE member_program_item_id = TEST_ITEM_3_ID
ORDER BY instance_number;
```

**Test Steps (Manual - After Phase 6):**
1. Navigate to this program in UI
2. Go to Script tab
3. Click on Instance 4's status chip
4. Change from Pending to Redeemed
5. **EXPECTED:** Modal appears showing date mismatch
6. Choose "Yes, Adjust Future Dates"
7. **EXPECTED:** Instance 4's scheduled_date updates to today
8. **EXPECTED:** Instances 5-6 shift forward from Instance 4's new date

---

## Test Scenario 4: Mixed States (Missed + Redeemed + Pending)

**Purpose:** Verify missed items are preserved during regeneration (bug fix).

```sql
-- Create test program
INSERT INTO member_programs (
  lead_id,
  program_status_id,
  start_date,
  active_flag
) VALUES (
  TEST_LEAD_ID,
  ACTIVE_STATUS_ID,
  CURRENT_DATE - INTERVAL '35 days',  -- Started 5 weeks ago
  true
) RETURNING member_program_id;
-- Record as TEST_PROGRAM_4_ID: ___________

-- Add program item
INSERT INTO member_program_items (
  member_program_id,
  therapy_id,
  quantity,
  item_cost,
  item_charge,
  days_from_start,
  days_between,
  active_flag
) VALUES (
  TEST_PROGRAM_4_ID,
  TEST_THERAPY_ID,
  6,
  0.00,
  50.00,
  0,
  7,
  true
) RETURNING member_program_item_id;
-- Record as TEST_ITEM_4_ID: ___________

-- Generate schedule
SELECT generate_member_program_schedule(TEST_PROGRAM_4_ID);

-- Create mixed states:
-- Instance 1: Redeemed
-- Instance 2: Missed
-- Instance 3: Redeemed
-- Instance 4: Missed
-- Instance 5: Pending
-- Instance 6: Pending

UPDATE member_program_item_schedule
SET completed_flag = true
WHERE member_program_item_id = TEST_ITEM_4_ID
  AND instance_number IN (1, 3);

UPDATE member_program_item_schedule
SET completed_flag = false
WHERE member_program_item_id = TEST_ITEM_4_ID
  AND instance_number IN (2, 4);

-- Capture BEFORE state
SELECT 
  instance_number,
  scheduled_date,
  completed_flag,
  scheduled_date as original_date  -- Save for comparison
FROM member_program_item_schedule
WHERE member_program_item_id = TEST_ITEM_4_ID
ORDER BY instance_number;

-- CRITICAL TEST: Regenerate schedule
SELECT generate_member_program_schedule(TEST_PROGRAM_4_ID);

-- Verify AFTER state
SELECT 
  instance_number,
  scheduled_date,
  completed_flag,
  CASE 
    WHEN completed_flag = TRUE THEN 'Redeemed ✅ (should be preserved)'
    WHEN completed_flag = FALSE THEN 'Missed ❌ (should be preserved - BUG FIX!)'
    WHEN completed_flag IS NULL THEN 'Pending ⭕ (should be regenerated)'
  END as status
FROM member_program_item_schedule
WHERE member_program_item_id = TEST_ITEM_4_ID
ORDER BY instance_number;
```

**Expected Results (AFTER BUG FIX in Phase 1.2):**
- Instance 1 (redeemed): ✅ Preserved with original date
- Instance 2 (missed): ✅ **Preserved with original date** (this is the bug fix!)
- Instance 3 (redeemed): ✅ Preserved with original date
- Instance 4 (missed): ✅ **Preserved with original date** (this is the bug fix!)
- Instance 5 (pending): ✅ Regenerated from Instance 3's date + 14 days
- Instance 6 (pending): ✅ Regenerated from Instance 3's date + 21 days

**Current Buggy Behavior (Before Fix):**
- Instances 2 & 4 (missed) would be DELETED and REGENERATED ❌

---

## Test Scenario 5: Program with Pause Period

**Purpose:** Verify pause days are correctly calculated and applied in Mode 2.

```sql
-- Create test program
INSERT INTO member_programs (
  lead_id,
  program_status_id,
  start_date,
  active_flag
) VALUES (
  TEST_LEAD_ID,
  ACTIVE_STATUS_ID,
  CURRENT_DATE - INTERVAL '30 days',  -- Started 30 days ago
  true
) RETURNING member_program_id;
-- Record as TEST_PROGRAM_5_ID: ___________

-- Add program item
INSERT INTO member_program_items (
  member_program_id,
  therapy_id,
  quantity,
  item_cost,
  item_charge,
  days_from_start,
  days_between,
  active_flag
) VALUES (
  TEST_PROGRAM_5_ID,
  TEST_THERAPY_ID,
  6,
  0.00,
  50.00,
  0,
  7,
  true
) RETURNING member_program_item_id;
-- Record as TEST_ITEM_5_ID: ___________

-- Generate initial schedule
SELECT generate_member_program_schedule(TEST_PROGRAM_5_ID);

-- Mark instances 1-3 as redeemed
UPDATE member_program_item_schedule
SET completed_flag = true
WHERE member_program_item_id = TEST_ITEM_5_ID
  AND instance_number IN (1, 2, 3);

-- Record Instance 3's date (this will be our anchor)
SELECT 
  instance_number,
  scheduled_date as anchor_date
FROM member_program_item_schedule
WHERE member_program_item_id = TEST_ITEM_5_ID
  AND instance_number = 3;
-- Record this date: ANCHOR_DATE = ___________

-- NOW: Simulate a pause period
-- Find Paused status
SELECT program_status_id 
FROM program_status 
WHERE LOWER(status_name) = 'paused';
-- Record as PAUSED_STATUS_ID: ___________

-- Pause the program (this creates audit log entry)
UPDATE member_programs
SET program_status_id = PAUSED_STATUS_ID
WHERE member_program_id = TEST_PROGRAM_5_ID;

-- Wait a moment or manually insert audit log if needed
-- (In real scenario, audit log is automatic)

-- Resume the program after 10 days (simulated)
-- For testing, we'll manually set it back to Active
-- and verify the pause calculation works

-- Change back to Active
UPDATE member_programs
SET program_status_id = ACTIVE_STATUS_ID
WHERE member_program_id = TEST_PROGRAM_5_ID;

-- Check audit log captured the pause
SELECT 
  changed_at,
  column_name,
  old_value,
  new_value
FROM audit_logs
WHERE table_name = 'member_programs'
  AND record_id = TEST_PROGRAM_5_ID
  AND column_name = 'program_status_id'
ORDER BY changed_at DESC;

-- Calculate expected pause days
-- (This will be used by compute_pause_days_since_date function)
SELECT compute_program_total_pause_days(TEST_PROGRAM_5_ID) as total_pause_days;

-- Regenerate schedule
SELECT generate_member_program_schedule(TEST_PROGRAM_5_ID);

-- Verify instances 4-6 include pause adjustment
SELECT 
  instance_number,
  scheduled_date,
  completed_flag,
  scheduled_date - LAG(scheduled_date) OVER (ORDER BY instance_number) as days_from_previous
FROM member_program_item_schedule
WHERE member_program_item_id = TEST_ITEM_5_ID
ORDER BY instance_number;
```

**Expected Results:**
- Instances 1-3: Preserved as redeemed
- Instances 4-6: Dates shifted forward by pause_days_since(Instance 3 date)
- `days_from_previous` for instance 4 should be: 7 days (base) + pause days

---

## Test Data Summary Table

After creating all test scenarios, fill in this table:

| Test # | Program ID | Item ID | Purpose | Expected Instances |
|--------|-----------|---------|---------|-------------------|
| 1 | _________ | _______ | Fresh start (Mode 1) | 6 pending |
| 2 | _________ | _______ | On-time completions (Mode 2) | 3 redeemed, 3 pending |
| 3 | _________ | _______ | Late redemption test | 3 redeemed, 3 pending (for manual test) |
| 4 | _________ | _______ | Mixed states (bug fix) | 2 redeemed, 2 missed, 2 pending |
| 5 | _________ | _______ | With pause period | 3 redeemed, 3 pending |

---

## Validation Queries

Use these queries throughout implementation to verify correctness:

```sql
-- Count completion states across all test programs
SELECT 
  completed_flag,
  COUNT(*) as count,
  CASE 
    WHEN completed_flag = TRUE THEN 'Redeemed'
    WHEN completed_flag = FALSE THEN 'Missed'
    WHEN completed_flag IS NULL THEN 'Pending'
  END as status
FROM member_program_item_schedule s
JOIN member_program_items i ON s.member_program_item_id = i.member_program_item_id
WHERE i.member_program_id IN (TEST_PROGRAM_1_ID, TEST_PROGRAM_2_ID, TEST_PROGRAM_3_ID, TEST_PROGRAM_4_ID, TEST_PROGRAM_5_ID)
GROUP BY completed_flag
ORDER BY completed_flag NULLS FIRST;

-- Verify no weekend dates
SELECT 
  s.member_program_item_schedule_id,
  s.scheduled_date,
  EXTRACT(DOW FROM s.scheduled_date) as day_of_week,
  CASE EXTRACT(DOW FROM s.scheduled_date)
    WHEN 0 THEN '❌ SUNDAY - ERROR!'
    WHEN 6 THEN '❌ SATURDAY - ERROR!'
    ELSE '✅ Weekday'
  END as weekend_check
FROM member_program_item_schedule s
JOIN member_program_items i ON s.member_program_item_id = i.member_program_item_id
WHERE i.member_program_id IN (TEST_PROGRAM_1_ID, TEST_PROGRAM_2_ID, TEST_PROGRAM_3_ID, TEST_PROGRAM_4_ID, TEST_PROGRAM_5_ID)
  AND EXTRACT(DOW FROM s.scheduled_date) IN (0, 6);
-- Should return 0 rows
```

---

## Cleanup Script (Run After Testing Complete)

```sql
-- WARNING: This deletes all test data created above
-- Only run when testing is complete and successful

-- Delete schedules
DELETE FROM member_program_items_task_schedule
WHERE member_program_item_schedule_id IN (
  SELECT s.member_program_item_schedule_id
  FROM member_program_item_schedule s
  JOIN member_program_items i ON s.member_program_item_id = i.member_program_item_id
  WHERE i.member_program_id IN (TEST_PROGRAM_1_ID, TEST_PROGRAM_2_ID, TEST_PROGRAM_3_ID, TEST_PROGRAM_4_ID, TEST_PROGRAM_5_ID)
);

DELETE FROM member_program_item_schedule
WHERE member_program_item_id IN (
  SELECT member_program_item_id
  FROM member_program_items
  WHERE member_program_id IN (TEST_PROGRAM_1_ID, TEST_PROGRAM_2_ID, TEST_PROGRAM_3_ID, TEST_PROGRAM_4_ID, TEST_PROGRAM_5_ID)
);

-- Delete items
DELETE FROM member_program_items
WHERE member_program_id IN (TEST_PROGRAM_1_ID, TEST_PROGRAM_2_ID, TEST_PROGRAM_3_ID, TEST_PROGRAM_4_ID, TEST_PROGRAM_5_ID);

-- Delete programs
DELETE FROM member_programs
WHERE member_program_id IN (TEST_PROGRAM_1_ID, TEST_PROGRAM_2_ID, TEST_PROGRAM_3_ID, TEST_PROGRAM_4_ID, TEST_PROGRAM_5_ID);

SELECT 'Test data cleanup complete' as status;
```

---

## Next Steps

Once test data is created:
- [ ] Document all test program IDs and item IDs in the summary table
- [ ] Run initial validation queries
- [ ] Proceed to Phase 1: Database Foundation

---

**Document Created:** 2025-11-20
**Status:** Ready for test data creation

