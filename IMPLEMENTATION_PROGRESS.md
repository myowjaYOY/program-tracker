# Three-State Status Implementation Progress

## ✅ **COMPLETED PHASES**

### Phase 1: Database Migration ✅
- Created `migrations/20251028_phase1_allow_null_schedule_status.sql`
- Applied migration successfully
- Tables now allow NULL but DEFAULT remains false (backward compatible)
- **Status**: Production-safe migration applied

### Phase 2: TypeScript Types ✅  
- Row types updated to support `boolean | null`
- **Status**: Ready for null values

### Phase 3: Utility Functions ✅
- Created `src/lib/utils/schedule-status.ts`
- Exported `getScheduleStatus()`, `getNextStatus()`, `STATUS_CONFIG`
- **Status**: Complete

### Phase 4: StatusChip Component ✅
- Created `src/components/ui/schedule-status-chip.tsx`
- Reusable component with icons and tooltips
- Supports read-only mode
- **Status**: Complete

### Phase 5: API Routes ✅
- Updated `src/app/api/coordinator/script/route.ts`
- Updated `src/app/api/coordinator/todo/route.ts`
- Both now filter with `.or('completed_flag.is.null,completed_flag.eq.false')`
- **Status**: Complete

### Phase 6: Coordinator Script Tab UI ✅
- Updated `src/components/coordinator/script-tab.tsx`
- Changed column header: "Completed" → "Redeemed"
- Replaced Chip with ScheduleStatusChip
- Updated `handleStatusChange()` to accept `newValue` parameter
- Updated `rowClassName` to only color NULL (pending) items
- **Status**: Complete

---

## 🔄 **IN PROGRESS**

### Phase 7: Coordinator To Do Tab UI (NEXT)
Need to apply same changes as Script Tab:
1. Import ScheduleStatusChip
2. Update Row type
3. Update toggleComplete → handleStatusChange
4. Change column header to "Redeemed"
5. Use ScheduleStatusChip
6. Update rowClassName

### Phase 8: Program Script Tab UI (Read-Only)
Simpler - just display StatusChip without onclick

### Phase 9: Zod Validations
Update schemas to accept `boolean | null`

### Phase 10: Testing
Test all three states across all tabs

---

## 📋 **REMAINING TASKS**

- [ ] Complete Coordinator To Do Tab
- [ ] Update Program Script Tab  
- [ ] Update Zod validations
- [ ] Test thoroughly
- [ ] Document Phase 2 migration (to run after UI deployment)

---

## 🚀 **DEPLOYMENT PLAN**

### Current State (Dev):
- ✅ Database allows NULL (Phase 1 applied)
- ✅ New UI supports three states
- ⚠️ DEFAULT still false (backward compatible)

### Next Steps:
1. Complete remaining UI updates
2. Test in dev
3. Deploy to production
4. **THEN** apply Phase 2 migration (change DEFAULT to NULL, backfill data)

---

## 📝 **PHASE 2 MIGRATION** (Run AFTER UI Deployed)

```sql
-- migrations/20251028_phase2_switch_to_null_schedule_status.sql

BEGIN;

-- Change DEFAULT to NULL
ALTER TABLE member_program_item_schedule 
  ALTER COLUMN completed_flag SET DEFAULT NULL;

ALTER TABLE member_program_items_task_schedule 
  ALTER COLUMN completed_flag SET DEFAULT NULL;

-- Backfill: convert false → NULL
UPDATE member_program_item_schedule
SET completed_flag = NULL
WHERE completed_flag = false;

UPDATE member_program_items_task_schedule
SET completed_flag = NULL
WHERE completed_flag = false;

COMMIT;
```

This migration is SAFE to run after new UI is deployed.

