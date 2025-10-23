# Program Role ID Migration Guide

## Overview
This migration adds `program_role_id` columns to all therapy-related tables to enable role-based responsibility tracking throughout the system.

---

## Files Created

1. **`add_program_role_id_columns.sql`** - Forward migration (adds columns)
2. **`rollback_program_role_id_columns.sql`** - Rollback migration (removes columns)
3. **`PROGRAM_ROLE_ID_MIGRATION_GUIDE.md`** - This guide

---

## What Gets Added

### Tables Modified (7 tables):
1. ✅ `therapies` - Default role for therapy type (e.g., Blood Draw = Provider)
2. ✅ `therapy_tasks` - Role for tasks (e.g., Schedule Follow-up = Coordinator)
3. ✅ `program_template_items` - Inherits from therapy, can override
4. ✅ `member_program_items` - Inherits from template, can override
5. ✅ `member_program_item_tasks` - Inherits from therapy_tasks
6. ✅ `member_program_item_schedule` - For coordinator script filtering
7. ✅ `member_program_items_task_schedule` - For coordinator todo filtering

### Default Value:
- All columns default to **ID 2 (Admin role)**
- All existing records will be set to Admin
- You can update specific therapies/tasks to different roles after migration

### Database Objects Created:
- **7 columns** (program_role_id in each table)
- **7 foreign key constraints** (references program_roles table)
- **7 indexes** (for filtering and performance)
- **7 column comments** (documentation)

---

## How to Run the Migration

### Step 1: Backup Your Database (CRITICAL!)
```bash
# Create a backup before running ANY migration
pg_dump -h your-host -U your-user -d your-database > backup_before_role_migration.sql
```

### Step 2: Test in Development First
If you have a development/staging environment, run there first!

### Step 3: Run the Forward Migration
```sql
-- Option A: Using psql command line
psql -h your-host -U your-user -d your-database -f migrations/add_program_role_id_columns.sql

-- Option B: Copy/paste into Supabase SQL Editor
-- Open the file, copy all contents, paste into SQL Editor, click "Run"

-- Option C: Using MCP (if available)
-- Use mcp_supabase_apply_migration tool
```

### Step 4: Verify the Migration
```sql
-- Run these verification queries (uncomment in the migration file):

-- 1. Check columns were added
SELECT 
  table_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'program_role_id'
  AND table_schema = 'public'
ORDER BY table_name;

-- 2. Check foreign keys were created
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'program_role_id'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 3. Check indexes were created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE '%program_role_id%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 4. Verify all records have default role (ID 2 - Admin)
SELECT 'therapies' as table_name, program_role_id, COUNT(*) as count
FROM therapies
GROUP BY program_role_id
UNION ALL
SELECT 'therapy_tasks', program_role_id, COUNT(*)
FROM therapy_tasks
GROUP BY program_role_id
UNION ALL
SELECT 'program_template_items', program_role_id, COUNT(*)
FROM program_template_items
GROUP BY program_role_id;
```

### Expected Results:
- ✅ 7 columns added
- ✅ 7 foreign keys created
- ✅ 7 indexes created
- ✅ All existing records have `program_role_id = 2` (Admin)

---

## If Something Goes Wrong - Rollback

### When to Rollback:
- Migration fails partway through
- Foreign key constraint errors
- Index creation fails
- You need to revert for any reason

### How to Rollback:
```sql
-- Run the rollback script
psql -h your-host -U your-user -d your-database -f migrations/rollback_program_role_id_columns.sql

-- Or copy/paste into Supabase SQL Editor
```

### After Rollback:
- All program_role_id columns will be removed
- All foreign keys will be removed
- All indexes will be removed
- Data in other columns remains intact
- You can re-run the forward migration after fixing issues

---

## Data Flow After Migration

### Therapy Definition → Template → Program → Schedule

```
1. THERAPIES TABLE (Master Definition)
   therapies.program_role_id = Provider (ID 4)
   ↓
2. PROGRAM TEMPLATE ITEMS (Inherits from therapy)
   When user adds therapy to template:
   - Copy therapies.cost → program_template_items.cost
   - Copy therapies.charge → program_template_items.charge
   - Copy therapies.program_role_id → program_template_items.program_role_id
   ↓
3. MEMBER PROGRAM ITEMS (Inherits from template)
   When template instantiated:
   - Copy program_template_items.program_role_id → member_program_items.program_role_id
   ↓
4. MEMBER PROGRAM ITEM SCHEDULE (Copied for filtering)
   When schedule generated:
   - Copy member_program_items.program_role_id → member_program_item_schedule.program_role_id
   ↓
5. COORDINATOR SCRIPT VIEW
   - Filter by program_role_id to show "my tasks"
```

### Similar flow for Tasks:

```
therapy_tasks.program_role_id
  ↓
member_program_item_tasks.program_role_id
  ↓
member_program_items_task_schedule.program_role_id
  ↓
Coordinator To-Do filtered view
```

---

## Post-Migration Tasks

### 1. Update Common Therapies with Appropriate Roles
```sql
-- Example: Assign roles to common therapies

-- Blood draws and labs → Provider
UPDATE therapies 
SET program_role_id = 4 -- Provider
WHERE therapy_name ILIKE '%blood%' 
   OR therapy_name ILIKE '%lab%'
   OR therapy_name ILIKE '%test%';

-- Follow-up calls → Coordinator
UPDATE therapies 
SET program_role_id = 1 -- Coordinator
WHERE therapy_name ILIKE '%call%' 
   OR therapy_name ILIKE '%follow%'
   OR therapy_name ILIKE '%check-in%';

-- Supplements and shipments → Admin
UPDATE therapies 
SET program_role_id = 2 -- Admin
WHERE therapy_name ILIKE '%supplement%' 
   OR therapy_name ILIKE '%shipment%'
   OR therapy_name ILIKE '%delivery%';

-- Member self-tasks → Member
UPDATE therapies 
SET program_role_id = 3 -- Member
WHERE therapy_name ILIKE '%self%' 
   OR therapy_name ILIKE '%homework%'
   OR therapy_name ILIKE '%journal%';
```

### 2. Update TypeScript Types
```typescript
// src/types/database.types.ts

export interface Therapies {
  therapy_id: number;
  therapy_name: string;
  // ... existing fields ...
  program_role_id: number | null;  // ADD THIS
}

export interface ProgramTemplateItems {
  program_template_items_id: number;
  // ... existing fields ...
  program_role_id: number | null;  // ADD THIS
}

export interface MemberProgramItems {
  member_program_item_id: number;
  // ... existing fields ...
  program_role_id: number | null;  // ADD THIS
}

// ... repeat for other interfaces
```

### 3. Update Validation Schemas
```typescript
// src/lib/validations/therapy.ts
export const therapySchema = z.object({
  // ... existing fields ...
  program_role_id: z.number().int().positive().optional(),
});

// Similar for program-template-item.ts, member-program-item.ts, etc.
```

### 4. Update Forms
```typescript
// Add role dropdown to therapy form, template item form, etc.
<Controller
  name="program_role_id"
  control={control}
  render={({ field }) => (
    <FormControl fullWidth>
      <InputLabel>Responsible Role</InputLabel>
      <Select {...field}>
        {(roles || []).map(role => (
          <MenuItem key={role.program_role_id} value={role.program_role_id}>
            {role.role_name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )}
/>
```

### 5. Update Database Functions
Update these functions to propagate `program_role_id`:
- `copy_program_template()` - Include program_role_id when copying
- `generate_member_program_schedule()` - Copy role to schedules
- `apply_member_program_items_changes()` - Handle role in changes

### 6. Update API Routes
All CRUD endpoints for:
- `/api/therapies`
- `/api/therapy-tasks`
- `/api/program-templates/[id]/items`
- `/api/member-programs/[id]/items`
- `/api/member-programs/[id]/tasks`

Include `program_role_id` in SELECT, INSERT, UPDATE operations.

### 7. Update UI Tables
Add "Responsible Role" column to:
- Therapies table
- Therapy tasks table
- Template items table
- Program items table
- Program tasks table
- Coordinator script table (with filtering)
- Coordinator todo table (with filtering)

---

## Benefits After Full Implementation

### For Coordinators:
- **Filter Script**: "Show me only Provider tasks for today"
- **Filter To-Do**: "Show me only my Coordinator tasks"
- **Clear Ownership**: Know who's responsible for what

### For Reports:
- "How many tasks are assigned to each role?"
- "Which roles are overloaded?"
- "Average completion time by role"

### For Workflow:
- Automatic role assignment based on therapy type
- Consistent responsibility tracking
- Easy delegation and handoffs

---

## Migration Statistics

**Estimated Time:** 5-10 seconds (depends on data volume)

**Estimated Disk Space:** Minimal
- 7 columns × ~4-8 bytes per row
- Plus index overhead
- Typical: < 1MB for most databases

**Downtime Required:** None (columns are added with defaults)

**Risk Level:** Low
- Non-destructive (adds columns, doesn't remove)
- Nullable with defaults (no data loss)
- Easy rollback available

---

## Troubleshooting

### Error: "column already exists"
**Solution:** Column was already added. Check if migration was run before.
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'therapies' AND column_name = 'program_role_id';
```

### Error: "foreign key constraint violation"
**Cause:** program_roles table doesn't exist or ID 2 doesn't exist.
**Solution:** Run `add_program_roles_table.sql` migration first.

### Error: "permission denied"
**Cause:** User doesn't have ALTER TABLE privileges.
**Solution:** Run as database owner or grant permissions.

### Error: "index already exists"
**Cause:** Index creation failed but index was created.
**Solution:** Drop the index and re-run, or skip index creation.

---

## Success Checklist

After migration completes:
- [ ] 7 columns added (verify with SELECT)
- [ ] 7 foreign keys created (verify constraints)
- [ ] 7 indexes created (verify indexes)
- [ ] All existing records have role_id = 2
- [ ] No error messages in logs
- [ ] Application still loads properly
- [ ] Can create new therapies
- [ ] Can create new program items

---

## Support

If you encounter issues:
1. Check the verification queries above
2. Review error messages in database logs
3. Use rollback script if needed
4. Don't panic - rollback is safe and easy

---

**END OF MIGRATION GUIDE**


