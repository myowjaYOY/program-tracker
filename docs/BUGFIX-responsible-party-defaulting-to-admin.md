# Bug Fix: Responsible Party Defaulting to Admin

## Problem
Tasks in `member_program_item_tasks` and `member_program_items_task_schedule` were showing "Admin" as the responsible party instead of the role assigned in the therapy definition.

## Root Cause
**API Route Bug:** `src/app/api/member-programs/[id]/items/route.ts`

When adding an item to a program (lines 170-201), the code copies tasks from `therapy_tasks` to `member_program_item_tasks` but was **NOT** copying the `program_role_id` field:

```typescript
// ❌ OLD CODE (BUGGY)
const { data: tasks } = await supabase
  .from('therapy_tasks')
  .select('task_id, task_name, description, task_delay')  // Missing program_role_id!
  // ...
const toInsert = tasks.map((t: any) => ({
  // ...
  task_delay: t.task_delay,
  // Missing: program_role_id
  created_by: session.user.id,
}));
```

This caused:
1. Tasks created via API had `program_role_id = NULL` (or defaulted to admin)
2. When `generate_member_program_schedule()` ran, it copied the NULL/wrong role to schedule tasks
3. Users saw "Admin" instead of "Member", "Coordinator", etc.

## Files Changed

### 1. **TypeScript Types** - `src/types/database.types.ts`
- ✅ Added `program_role_id: number` to `MemberProgramItemTasks` interface
- This field existed in the database but was missing from TypeScript types

### 2. **API Route** - `src/app/api/member-programs/[id]/items/route.ts`
- ✅ Line 172: Added `program_role_id` to the SELECT query
- ✅ Line 192: Added `program_role_id: t.program_role_id` to the INSERT data

### 3. **SQL Fix Script** - `sql/fix_missing_program_role_id.sql`
- Comprehensive diagnostic and repair script
- Checks if columns exist in both tables
- Shows current program_roles and their IDs
- Finds tasks with NULL or incorrect `program_role_id`
- Backfills existing data with correct roles from `therapy_tasks`
- Verification queries to confirm the fix

## Impact
- ✅ **Future items:** New items added via UI will now have correct responsible party
- ⚠️ **Existing data:** May have incorrect roles - needs backfill (see SQL script)
- ✅ **Program creation from template:** Already fixed by `migrations/20251028_fix_program_creation_role_copy.sql`
- ✅ **Schedule generation:** Already fixed by `migrations/20251028_fix_schedule_role_propagation.sql`

## Deployment Steps

### 1. Deploy Code Changes
The TypeScript and API changes are already made in the codebase. No action needed.

### 2. Run SQL Fix Script
Execute `sql/fix_missing_program_role_id.sql` in Supabase SQL Editor:

1. Open Supabase Dashboard → SQL Editor
2. Paste entire contents of `sql/fix_missing_program_role_id.sql`
3. Click "Run"
4. Review diagnostic output:
   - Shows which tasks have wrong/missing roles
   - Backfills correct roles from `therapy_tasks`
   - Verifies fix worked (should show 0 rows needing correction)

### 3. Verify in UI
1. Go to any program
2. Add a new therapy item
3. Check Program Tasks Tab → verify responsible party matches therapy definition
4. Click "Generate Schedule"
5. Check Coordinator Dashboard → verify tasks show correct responsible party

## Technical Notes

### Database Schema
Both tables now have `program_role_id`:
- `member_program_item_tasks.program_role_id` → References `program_roles.program_role_id`
- `member_program_items_task_schedule.program_role_id` → References `program_roles.program_role_id`

### Data Flow
1. **Therapy Definition:** `therapy_tasks.program_role_id` (source of truth)
2. **When Item Added:** Copied to `member_program_item_tasks.program_role_id` (via API)
3. **When Schedule Generated:** Copied to `member_program_items_task_schedule.program_role_id` (via SQL function)

### Related Migrations
- `migrations/20251028_fix_program_creation_role_copy.sql` - Fixed program creation from templates
- `migrations/20251028_fix_schedule_role_propagation.sql` - Fixed schedule generation function

## Testing Checklist
- [ ] Run SQL diagnostic script - verify it finds tasks with wrong roles
- [ ] Run SQL backfill script - update existing data
- [ ] Add new item to a program via UI
- [ ] Verify task has correct responsible party in Program Tasks tab
- [ ] Generate schedule for the program
- [ ] Verify scheduled tasks have correct responsible party in Coordinator dashboard
- [ ] Check both member-assigned and coordinator-assigned tasks

## Status
- ✅ **Code Fixed:** TypeScript types and API route updated
- ⏳ **Database Fixed:** SQL script ready to run
- ⏳ **Testing:** Awaiting deployment and verification

