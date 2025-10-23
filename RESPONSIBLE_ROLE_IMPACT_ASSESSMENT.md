# Responsible Role Impact Assessment
## Adding Responsible Role to Items and Tasks

**Date:** October 21, 2025
**Assessment Type:** Major System Change - Database, API, UI, Business Logic
**Requested By:** User
**Conducted By:** AI Assistant (using MCP database interrogation)

---

## Executive Summary

This assessment analyzes the impact of adding a **"responsible role"** field to items and tasks throughout the system. The responsible role will propagate from:
- **Therapy Tasks** → **Member Program Item Tasks** (To-Do Items)
- **Program Template Items** → **Member Program Items** → **Member Program Item Schedule** (Script Items)

### Impact Level: **HIGH** 🔴
- **Database Objects Affected:** 6 tables, 9+ functions/triggers
- **API Routes Affected:** 20+ endpoints
- **UI Components Affected:** 15+ components
- **Validation Schemas Affected:** 4 files
- **TypeScript Types Affected:** 2 files
- **Business Logic Functions Affected:** 3+ critical stored procedures

---

## 1. Database Schema Impact

### 1.1 Tables Requiring New Column: `responsible_role`

#### **Primary Tables (Source of Role Assignment)**

| Table | New Column | Data Type | Nullable | Default | Purpose |
|-------|-----------|-----------|----------|---------|---------|
| `therapy_tasks` | `responsible_role` | `text` or `varchar(100)` | YES | NULL | Source role for task-based items |
| `program_template_items` | `responsible_role` | `text` or `varchar(100)` | YES | NULL | Source role for therapy-based items |

#### **Propagation Tables (Inherit Role from Source)**

| Table | New Column | Data Type | Nullable | Default | Purpose |
|-------|-----------|-----------|----------|---------|---------|
| `member_program_items` | `responsible_role` | `text` or `varchar(100)` | YES | NULL | Inherited from template |
| `member_program_item_tasks` | `responsible_role` | `text` or `varchar(100)` | YES | NULL | Inherited from therapy_tasks |
| `member_program_item_schedule` | `responsible_role` | `text` or `varchar(100)` | YES | NULL | Copied from member_program_items |
| `member_program_items_task_schedule` | `responsible_role` | `text` or `varchar(100)` | YES | NULL | Copied from member_program_item_tasks |

### 1.2 Migration Script Requirements

```sql
-- Migration: Add responsible_role to items and tasks
BEGIN;

-- 1. Add columns to source tables
ALTER TABLE therapy_tasks 
  ADD COLUMN responsible_role text;

ALTER TABLE program_template_items 
  ADD COLUMN responsible_role text;

COMMENT ON COLUMN therapy_tasks.responsible_role IS 
  'Role responsible for this task (e.g., Coordinator, Admin, Member)';
  
COMMENT ON COLUMN program_template_items.responsible_role IS 
  'Role responsible for items derived from this template item';

-- 2. Add columns to propagation tables
ALTER TABLE member_program_items 
  ADD COLUMN responsible_role text;

ALTER TABLE member_program_item_tasks 
  ADD COLUMN responsible_role text;

ALTER TABLE member_program_item_schedule 
  ADD COLUMN responsible_role text;

ALTER TABLE member_program_items_task_schedule 
  ADD COLUMN responsible_role text;

COMMENT ON COLUMN member_program_items.responsible_role IS 
  'Role responsible for this item (inherited from program_template_items)';
  
COMMENT ON COLUMN member_program_item_tasks.responsible_role IS 
  'Role responsible for this task (inherited from therapy_tasks)';
  
COMMENT ON COLUMN member_program_item_schedule.responsible_role IS 
  'Role responsible for this scheduled item occurrence (copied from member_program_items)';
  
COMMENT ON COLUMN member_program_items_task_schedule.responsible_role IS 
  'Role responsible for this scheduled task (copied from member_program_item_tasks)';

-- 3. Create indexes for performance (role-based filtering)
CREATE INDEX idx_therapy_tasks_responsible_role 
  ON therapy_tasks(responsible_role) WHERE responsible_role IS NOT NULL;

CREATE INDEX idx_member_program_item_tasks_responsible_role 
  ON member_program_item_tasks(responsible_role) WHERE responsible_role IS NOT NULL;

CREATE INDEX idx_member_program_item_schedule_responsible_role 
  ON member_program_item_schedule(responsible_role) WHERE responsible_role IS NOT NULL;

CREATE INDEX idx_member_program_items_task_schedule_responsible_role 
  ON member_program_items_task_schedule(responsible_role) WHERE responsible_role IS NOT NULL;

COMMIT;
```

### 1.3 Database Functions Requiring Updates

Based on MCP interrogation, these critical functions **MUST** be updated:

#### **High Priority - Critical Functions**

1. **`copy_program_template()`**
   - **Current Behavior:** Copies template items without responsible_role
   - **Required Change:** Include `responsible_role` in INSERT statement
   - **Location:** Lines where `program_template_items` are copied
   - **Impact:** New templates won't inherit roles from source

2. **`generate_member_program_schedule()`**
   - **Current Behavior:** Creates schedule from items, creates task schedule from tasks
   - **Required Change:** 
     - Copy `responsible_role` from `member_program_items` to `member_program_item_schedule`
     - Copy `responsible_role` from `member_program_item_tasks` to `member_program_items_task_schedule`
   - **Impact:** Script items and todo items won't have responsible roles

3. **`apply_member_program_items_changes()`**
   - **Current Behavior:** Handles add/update/remove of program items
   - **Required Change:** Support `responsible_role` in add/update operations
   - **Impact:** Cannot modify responsible role via API

#### **Medium Priority - Audit Functions**

4. **`audit_member_program_items()`**
5. **`audit_member_program_item_tasks()`**
6. **`audit_member_item_schedule()`**
7. **`audit_member_item_task_schedule()`**
   - **Impact:** Audit trail won't capture responsible_role changes

#### **Lower Priority**

8. **`copy_program_template_exact()`** - Similar to copy_program_template
9. **`regen_member_program_task_schedule()`** - May need role propagation

### 1.4 Example Function Update - `generate_member_program_schedule()`

**Current INSERT (lines ~30-40):**
```sql
INSERT INTO public.member_program_item_schedule(
  member_program_item_id,
  instance_number,
  scheduled_date
)
VALUES (
  v_items.member_program_item_id,
  v_instance + 1,
  v_occurrence_date
)
```

**Updated INSERT:**
```sql
INSERT INTO public.member_program_item_schedule(
  member_program_item_id,
  instance_number,
  scheduled_date,
  responsible_role  -- NEW
)
SELECT
  v_items.member_program_item_id,
  v_instance + 1,
  v_occurrence_date,
  mpi.responsible_role  -- NEW: Copy from member_program_items
FROM member_program_items mpi
WHERE mpi.member_program_item_id = v_items.member_program_item_id
```

---

## 2. API Routes Impact

### 2.1 Routes Requiring Updates (20+ endpoints)

#### **Therapy Tasks** (`/api/therapy-tasks`)
- `POST /api/therapy-tasks/route.ts` - Add responsible_role to creation
- `PATCH /api/therapy-tasks/[id]/route.ts` - Add responsible_role to updates
- `GET /api/therapy-tasks/route.ts` - Return responsible_role in response

#### **Program Template Items** (`/api/program-templates`)
- `POST /api/program-templates/[id]/items/route.ts` - Add responsible_role to creation
- `PATCH /api/program-templates/[id]/items/[itemId]/route.ts` - Add responsible_role to updates
- `GET /api/program-templates/[id]/items/route.ts` - Return responsible_role

#### **Member Program Items** (`/api/member-programs`)
- `POST /api/member-programs/[id]/items/route.ts` - Add responsible_role to creation
- `PATCH /api/member-programs/[id]/items/[itemId]/route.ts` - Add responsible_role to updates
- `GET /api/member-programs/[id]/items/route.ts` - Return responsible_role
- `POST /api/member-programs/[id]/items/batch-apply` - Handle responsible_role in batch operations

#### **Member Program Item Tasks** (`/api/member-programs/tasks`)
- `GET /api/member-programs/[id]/tasks/route.ts` - Return responsible_role
- `PATCH /api/member-programs/[id]/tasks/[taskId]/route.ts` - Add responsible_role to updates

#### **Script/Schedule** (`/api/coordinator/script`, `/api/member-programs/schedule`)
- `GET /api/coordinator/script/route.ts` - Return responsible_role for filtering
- `GET /api/member-programs/[id]/schedule/route.ts` - Return responsible_role
- `PATCH /api/member-programs/[id]/schedule/[scheduleId]/route.ts` - Add responsible_role to updates

#### **To-Do/Task Schedule** (`/api/coordinator/todo`, `/api/member-programs/todo`)
- `GET /api/coordinator/todo/route.ts` - Return responsible_role for filtering
- `GET /api/member-programs/[id]/todo/route.ts` - Return responsible_role
- `PATCH /api/member-programs/[id]/todo/[taskScheduleId]/route.ts` - Add responsible_role to updates

#### **Reports** (`/api/reports`)
- `GET /api/reports/inventory-forecast/route.ts` - May need responsible_role for filtering

#### **Debug Routes** (10+ routes)
- All debug routes that query items/tasks should include responsible_role

### 2.2 Example API Route Update

**File:** `src/app/api/therapy-tasks/route.ts`

**Before:**
```typescript
export async function POST(req: NextRequest) {
  // ... auth checks ...
  
  const validatedData = therapyTaskSchema.parse(body);
  
  const { data, error } = await supabase
    .from('therapy_tasks')
    .insert({
      therapy_id: validatedData.therapy_id,
      task_name: validatedData.task_name,
      description: validatedData.description,
      task_delay: validatedData.task_delay,
      active_flag: validatedData.active_flag,
    })
    .select()
    .single();
}
```

**After:**
```typescript
export async function POST(req: NextRequest) {
  // ... auth checks ...
  
  const validatedData = therapyTaskSchema.parse(body);
  
  const { data, error } = await supabase
    .from('therapy_tasks')
    .insert({
      therapy_id: validatedData.therapy_id,
      task_name: validatedData.task_name,
      description: validatedData.description,
      task_delay: validatedData.task_delay,
      active_flag: validatedData.active_flag,
      responsible_role: validatedData.responsible_role,  // NEW
    })
    .select()
    .single();
}
```

---

## 3. Validation Schemas Impact

### 3.1 Zod Schemas Requiring Updates

| File | Schema | Change Required |
|------|--------|-----------------|
| `src/lib/validations/therapy-task.ts` | `therapyTaskSchema`, `therapyTaskFormSchema` | Add `responsible_role: z.string().optional()` |
| `src/lib/validations/program-template-item.ts` | `programTemplateItemSchema` | Add `responsible_role: z.string().optional()` |
| `src/lib/validations/member-program-item.ts` | `memberProgramItemSchema` | Add `responsible_role: z.string().optional()` |
| `src/lib/validations/member-program-item-task.ts` | `memberProgramItemTaskSchema` | Add `responsible_role: z.string().optional()` |

### 3.2 Example Schema Update

**File:** `src/lib/validations/therapy-task.ts`

**Before:**
```typescript
export const therapyTaskSchema = z.object({
  therapy_id: z.number().int().positive('Therapy ID must be a positive integer'),
  task_name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  task_delay: z.number().int('Task delay must be an integer'),
  active_flag: z.boolean().default(true),
});
```

**After:**
```typescript
export const therapyTaskSchema = z.object({
  therapy_id: z.number().int().positive('Therapy ID must be a positive integer'),
  task_name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  task_delay: z.number().int('Task delay must be an integer'),
  active_flag: z.boolean().default(true),
  responsible_role: z.string()
    .max(100, 'Role cannot exceed 100 characters')
    .optional(),  // NEW
});
```

---

## 4. TypeScript Types Impact

### 4.1 Type Definitions Requiring Updates

**File:** `src/types/database.types.ts`

#### Interfaces to Update:

1. **`TherapyTasks`** (line ~444)
2. **`ProgramTemplateItems`** (line ~328)
3. **`MemberProgramItems`** (line ~84)
4. **`MemberProgramItemTasks`** (line ~116)
5. **`MemberProgramItemSchedule`** (need to verify if interface exists)
6. **`MemberProgramItemsTaskSchedule`** (need to verify if interface exists)

### 4.2 Example Type Update

**Before:**
```typescript
export interface TherapyTasks {
  task_id: number;
  therapy_id: number;
  task_name: string;
  description: string | null;
  task_delay: number;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}
```

**After:**
```typescript
export interface TherapyTasks {
  task_id: number;
  therapy_id: number;
  task_name: string;
  description: string | null;
  task_delay: number;
  active_flag: boolean;
  responsible_role: string | null;  // NEW
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}
```

---

## 5. UI Components Impact

### 5.1 Forms Requiring Updates (Add Responsible Role Field)

| Component | Path | Type | Change Required |
|-----------|------|------|-----------------|
| Therapy Task Form | `src/components/forms/therapy-task-form.tsx` | Create/Edit | Add role dropdown/input |
| Template Item Form | `src/components/admin/program-templates/add-template-item-form.tsx` | Create/Edit | Add role dropdown/input |
| Program Item Form | `src/components/programs/add-program-item-form.tsx` | Create/Edit | Add role dropdown/input |

### 5.2 Tables/DataGrids Requiring Updates (Add Responsible Role Column)

| Component | Path | Purpose | Change Required |
|-----------|------|---------|-----------------|
| Template Items Tab | `src/components/admin/program-templates/template-items-tab.tsx` | Display template items | Add `responsible_role` column |
| Program Tasks Tab | `src/components/programs/program-tasks-tab.tsx` | Display member tasks | Add `responsible_role` column |
| Program Script Tab | `src/components/programs/program-script-tab.tsx` | Display scheduled items | Add `responsible_role` column, enable filtering |
| Program To-Do Tab | `src/components/programs/program-todo-tab.tsx` | Display scheduled tasks | Add `responsible_role` column, enable filtering |
| Coordinator Script Tab | `src/components/coordinator/script-tab.tsx` | All script items | Add `responsible_role` column, enable filtering |
| Coordinator To-Do Tab | `src/components/coordinator/todo-tab.tsx` | All todo items | Add `responsible_role` column, enable filtering |

### 5.3 Example UI Update - Therapy Task Form

**File:** `src/components/forms/therapy-task-form.tsx`

Add this field after `task_delay`:

```typescript
<Grid item xs={12} sm={6}>
  <Controller
    name="responsible_role"
    control={control}
    render={({ field }) => (
      <TextField
        {...field}
        label="Responsible Role"
        error={!!errors.responsible_role}
        helperText={
          errors.responsible_role?.message || 
          'Who is responsible for this task? (e.g., Coordinator, Admin, Member)'
        }
        fullWidth
      />
    )}
  />
</Grid>
```

Or use a Select dropdown for predefined roles:

```typescript
<Grid item xs={12} sm={6}>
  <Controller
    name="responsible_role"
    control={control}
    render={({ field }) => (
      <FormControl fullWidth error={!!errors.responsible_role}>
        <InputLabel>Responsible Role</InputLabel>
        <Select
          {...field}
          label="Responsible Role"
        >
          <MenuItem value="">None</MenuItem>
          <MenuItem value="Coordinator">Coordinator</MenuItem>
          <MenuItem value="Admin">Admin</MenuItem>
          <MenuItem value="Member">Member</MenuItem>
          <MenuItem value="Practitioner">Practitioner</MenuItem>
        </Select>
        {errors.responsible_role && (
          <FormHelperText>{errors.responsible_role.message}</FormHelperText>
        )}
      </FormControl>
    )}
  />
</Grid>
```

### 5.4 Example DataGrid Column Addition

**File:** `src/components/programs/program-tasks-tab.tsx`

Add to columns array:

```typescript
{
  field: 'responsible_role',
  headerName: 'Responsible',
  width: 130,
  renderCell: (params) => (
    params.value ? (
      <Chip 
        label={params.value} 
        size="small"
        color={
          params.value === 'Coordinator' ? 'primary' :
          params.value === 'Admin' ? 'secondary' :
          params.value === 'Member' ? 'success' :
          'default'
        }
      />
    ) : (
      <Typography variant="body2" color="text.secondary">—</Typography>
    )
  ),
},
```

---

## 6. React Query Hooks Impact

### 6.1 Hooks Requiring No Changes (Query Layer)

These hooks will automatically return `responsible_role` if API is updated:
- `src/lib/hooks/use-therapy-tasks.ts`
- `src/lib/hooks/use-program-template-items.ts`
- `src/lib/hooks/use-member-program-items.ts`
- `src/lib/hooks/use-member-program-item-tasks.ts`

### 6.2 Hooks That May Need Type Updates

If using strict typing, update mutation input types to include `responsible_role`:
- `useCreateTherapyTask()` mutation input type
- `useUpdateTherapyTask()` mutation input type
- `useCreateProgramTemplateItem()` mutation input type
- `useUpdateProgramTemplateItem()` mutation input type

---

## 7. Business Logic Impact

### 7.1 Data Flow - Responsible Role Propagation

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLE ASSIGNMENT SOURCES                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. therapy_tasks.responsible_role  (Task-based role)           │
│  2. program_template_items.responsible_role  (Item-based role)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ PROPAGATION
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TEMPLATE → MEMBER PROGRAMS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  program_template_items.responsible_role                        │
│              │                                                   │
│              ├──→ member_program_items.responsible_role         │
│              │            │                                      │
│              │            └──→ member_program_item_schedule.    │
│              │                 responsible_role (Script Items)  │
│              │                                                   │
│  therapy_tasks.responsible_role                                 │
│              │                                                   │
│              └──→ member_program_item_tasks.responsible_role    │
│                           │                                      │
│                           └──→ member_program_items_task_       │
│                                schedule.responsible_role         │
│                                (To-Do Items)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 When Role Assignment Occurs

| Event | Source | Target | Function |
|-------|--------|--------|----------|
| Template copied | `program_template_items` | New `program_template_items` | `copy_program_template()` |
| Program created from template | `program_template_items` | `member_program_items` | Template assignment logic |
| Tasks copied to program | `therapy_tasks` | `member_program_item_tasks` | Task creation logic |
| Schedule generated | `member_program_items` | `member_program_item_schedule` | `generate_member_program_schedule()` |
| Task schedule generated | `member_program_item_tasks` | `member_program_items_task_schedule` | `generate_member_program_schedule()` |

### 7.3 Critical Business Rules

1. **Immutability After Schedule Creation**
   - Once a script item (`member_program_item_schedule`) is created, its `responsible_role` should NOT change if the source `member_program_items.responsible_role` changes
   - Same for todo items: `member_program_items_task_schedule.responsible_role` is immutable
   - **Reason:** Preserves assignment at time of creation

2. **Re-generation Behavior**
   - If schedule is regenerated (e.g., program dates change), `responsible_role` should be re-copied from current source
   - **Impact:** Role changes in items/tasks will affect new schedule instances

3. **Manual Override Support**
   - Consider allowing manual override of `responsible_role` at schedule level
   - **Recommendation:** Add `responsible_role_override` column to schedule tables (future enhancement)

---

## 8. User Interface Enhancements

### 8.1 Filtering Requirements

**Coordinator Script Tab** (`src/components/coordinator/script-tab.tsx`)
- Add "Filter by Role" dropdown
- Options: All, Coordinator, Admin, Member, etc.
- Filter applied client-side or via API query param

**Coordinator To-Do Tab** (`src/components/coordinator/todo-tab.tsx`)
- Add "Filter by Role" dropdown
- Same options as Script tab

### 8.2 Visualization Requirements

**Role Badges/Chips:**
- Use consistent color scheme:
  - Coordinator: Blue (primary)
  - Admin: Purple (secondary)
  - Member: Green (success)
  - Practitioner: Orange (warning)
  - Unassigned: Grey (default)

**Role Icons (Optional):**
- Consider adding icons alongside text for visual clarity

---

## 9. Testing Requirements

### 9.1 Database Testing

- [ ] Verify migration runs cleanly on development database
- [ ] Test `copy_program_template()` with responsible_role
- [ ] Test `generate_member_program_schedule()` propagates roles
- [ ] Test `apply_member_program_items_changes()` handles role updates
- [ ] Verify indexes improve query performance for role filtering
- [ ] Test NULL values are handled correctly

### 9.2 API Testing

- [ ] Test POST to `/api/therapy-tasks` with responsible_role
- [ ] Test PATCH to `/api/therapy-tasks/[id]` updates responsible_role
- [ ] Test POST to `/api/program-templates/[id]/items` with responsible_role
- [ ] Test batch operations preserve responsible_role
- [ ] Test schedule generation includes responsible_role
- [ ] Verify coordinator script/todo endpoints return responsible_role

### 9.3 UI Testing

- [ ] Verify therapy task form displays responsible_role field
- [ ] Verify template item form displays responsible_role field
- [ ] Verify DataGrid columns display responsible_role correctly
- [ ] Test role filtering on coordinator script tab
- [ ] Test role filtering on coordinator todo tab
- [ ] Verify role badges render correctly
- [ ] Test form validation for responsible_role

### 9.4 Integration Testing

- [ ] Create therapy task with role → verify appears in member program tasks
- [ ] Create template item with role → verify appears in member program items
- [ ] Generate schedule → verify script items have correct role
- [ ] Generate schedule → verify todo items have correct role
- [ ] Update role in template → verify new programs get updated role
- [ ] Update role in therapy task → verify new member tasks get updated role

### 9.5 Regression Testing

- [ ] Verify existing programs without roles still work
- [ ] Verify schedule regeneration doesn't break
- [ ] Verify audit logs capture role changes
- [ ] Verify program copying still works
- [ ] Verify all existing queries still return data

---

## 10. Implementation Sequence (Recommended)

### Phase 1: Database Foundation (1-2 days)
1. ✅ Create and test migration script
2. ✅ Update database functions (`copy_program_template`, `generate_member_program_schedule`, `apply_member_program_items_changes`)
3. ✅ Update audit functions
4. ✅ Test all database changes in development environment

### Phase 2: Backend/API (2-3 days)
5. ✅ Update TypeScript type definitions (`database.types.ts`)
6. ✅ Update Zod validation schemas (4 files)
7. ✅ Update API routes for therapy tasks (3 endpoints)
8. ✅ Update API routes for program template items (3 endpoints)
9. ✅ Update API routes for member program items (4 endpoints)
10. ✅ Update API routes for member program tasks (2 endpoints)
11. ✅ Update API routes for schedule/script (3 endpoints)
12. ✅ Update API routes for todo (3 endpoints)
13. ✅ Test all API endpoints

### Phase 3: Frontend Forms (2-3 days)
14. ✅ Update therapy task form
15. ✅ Update program template item form
16. ✅ Update member program item form
17. ✅ Test all form submissions

### Phase 4: Frontend DataGrids (2-3 days)
18. ✅ Add responsible_role column to template items table
19. ✅ Add responsible_role column to program tasks table
20. ✅ Add responsible_role column to program script table
21. ✅ Add responsible_role column to program todo table
22. ✅ Add responsible_role column to coordinator script table
23. ✅ Add responsible_role column to coordinator todo table
24. ✅ Add filtering dropdowns to coordinator tabs

### Phase 5: Testing & QA (2-3 days)
25. ✅ Run complete test suite
26. ✅ Manual testing of all workflows
27. ✅ Performance testing (especially script/todo queries)
28. ✅ User acceptance testing

### Phase 6: Documentation & Deployment (1 day)
29. ✅ Update user documentation
30. ✅ Create deployment plan
31. ✅ Deploy to production
32. ✅ Monitor for issues

**Total Estimated Time: 10-15 days (2-3 weeks)**

---

## 11. Risks & Mitigation

### 11.1 Data Integrity Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Existing schedules don't have roles | Medium | High | Acceptable - NULL is valid; document behavior |
| Role not propagated in all code paths | High | Medium | Comprehensive testing; code review |
| Performance degradation on large tables | Medium | Low | Add indexes; test with production data size |

### 11.2 Business Logic Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Role changes don't propagate to existing schedules | Low | High | Expected behavior - document as immutable |
| Users assign incorrect roles | Medium | Medium | Provide role guidelines; consider dropdown instead of free text |
| Confusion about role vs. assigned user | Medium | Low | Clear UI labels; documentation |

### 11.3 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Database function updates introduce bugs | High | Medium | Extensive testing; rollback plan |
| API breaking changes affect integrations | High | Low | Maintain backward compatibility; document changes |
| UI changes confuse users | Low | Medium | User training; clear labels |

---

## 12. Rollback Plan

### 12.1 Database Rollback

```sql
-- Rollback migration if needed
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_therapy_tasks_responsible_role;
DROP INDEX IF EXISTS idx_member_program_item_tasks_responsible_role;
DROP INDEX IF EXISTS idx_member_program_item_schedule_responsible_role;
DROP INDEX IF EXISTS idx_member_program_items_task_schedule_responsible_role;

-- Remove columns
ALTER TABLE member_program_items_task_schedule DROP COLUMN IF EXISTS responsible_role;
ALTER TABLE member_program_item_schedule DROP COLUMN IF EXISTS responsible_role;
ALTER TABLE member_program_item_tasks DROP COLUMN IF EXISTS responsible_role;
ALTER TABLE member_program_items DROP COLUMN IF EXISTS responsible_role;
ALTER TABLE program_template_items DROP COLUMN IF EXISTS responsible_role;
ALTER TABLE therapy_tasks DROP COLUMN IF EXISTS responsible_role;

COMMIT;
```

### 12.2 Application Rollback

1. Revert all code changes (use git)
2. Restore previous database functions
3. Test application functionality
4. Deploy previous version

---

## 13. Alternative Approaches Considered

### 13.1 Lookup Table Approach

**Approach:** Create `responsible_roles` lookup table with predefined roles

**Pros:**
- Enforces data consistency
- Allows role attributes (e.g., display color, icon)
- Easier to rename roles globally

**Cons:**
- More complex schema
- Requires foreign key constraints
- Less flexible for custom roles

**Recommendation:** Consider for Phase 2 if role standardization is needed

### 13.2 User Assignment Instead of Role

**Approach:** Assign specific users instead of roles

**Pros:**
- More specific responsibility
- Can track who did what

**Cons:**
- Less flexible (users change)
- Doesn't indicate type of work
- Requires user management overhead

**Recommendation:** Roles are better for categorization; user assignment can be separate field

### 13.3 Role at Schedule Level Only

**Approach:** Only add role to schedule tables, not source tables

**Pros:**
- Fewer tables to update
- More flexible

**Cons:**
- No source of truth for default roles
- Must manually assign for each schedule instance
- Loses template-driven automation

**Recommendation:** Not recommended - defeats purpose of templating system

---

## 14. Post-Implementation Monitoring

### 14.1 Metrics to Track

- **Adoption Rate:** % of items/tasks with assigned roles
- **Query Performance:** Script/todo query times with role filtering
- **User Feedback:** Usability of role assignment UI
- **Data Quality:** Consistency of role values (if free text)

### 14.2 Success Criteria

- [ ] All new tasks have responsible_role assigned
- [ ] All new template items have responsible_role assigned
- [ ] Script/todo pages load in < 2 seconds with role filtering
- [ ] No increase in database errors
- [ ] Users report improved task organization

---

## 15. Questions & Decisions Needed

### 15.1 Role Value Format

**Question:** Should responsible_role be:
- **Free text** (any string)
- **Dropdown** (predefined values)
- **Foreign key** (lookup table)

**Recommendation:** Start with dropdown (predefined values in UI), store as text in database. This allows flexibility while guiding users.

**Suggested Values:**
- Coordinator
- Admin  
- Member
- Practitioner
- Finance
- (Allow "Other" with custom input)

### 15.2 Required vs. Optional

**Question:** Should responsible_role be required when creating items/tasks?

**Current Recommendation:** Optional (nullable)
- Allows gradual adoption
- Doesn't break existing workflows
- Can be enforced in UI with warnings

**Future State:** Consider making required after adoption period

### 15.3 Existing Data Backfill

**Question:** Should we backfill responsible_role for existing records?

**Recommendation:** 
- ❌ Don't backfill therapy_tasks or program_template_items (no reliable way to determine historical intent)
- ❌ Don't backfill member_program_items or member_program_item_tasks (inherited from templates/tasks)
- ✅ Allow NULL values in all tables
- ✅ Document that NULL means "unassigned" or "created before role assignment feature"

### 15.4 Schedule Regeneration Behavior

**Question:** When schedule is regenerated, should it:
- **Option A:** Preserve old responsible_role values
- **Option B:** Update to current responsible_role from source

**Recommendation:** Option B (update from source)
- Keeps schedules in sync with current templates
- Users can update template items to change all future schedules
- Completed items are never regenerated (preserved)

---

## 16. Documentation Requirements

### 16.1 User Documentation

- [ ] Update "Creating Therapy Tasks" guide
- [ ] Update "Managing Program Templates" guide
- [ ] Add "Responsible Role" explanation section
- [ ] Update coordinator workflow documentation
- [ ] Add screenshots of new UI fields

### 16.2 Developer Documentation

- [ ] Update API documentation with new field
- [ ] Document data flow for responsible_role
- [ ] Add examples to API integration guide
- [ ] Update database schema diagram

### 16.3 Training Materials

- [ ] Create video walkthrough of role assignment
- [ ] Add role assignment to onboarding checklist
- [ ] Create FAQ document

---

## 17. Appendix: File Checklist

### 17.1 Database Files
- [ ] `migrations/YYYYMMDD_add_responsible_role.sql` (NEW)
- [ ] Update `copy_program_template()` function
- [ ] Update `generate_member_program_schedule()` function
- [ ] Update `apply_member_program_items_changes()` function
- [ ] Update audit functions (4 functions)

### 17.2 Validation Files
- [ ] `src/lib/validations/therapy-task.ts`
- [ ] `src/lib/validations/program-template-item.ts`
- [ ] `src/lib/validations/member-program-item.ts`
- [ ] `src/lib/validations/member-program-item-task.ts`

### 17.3 Type Files
- [ ] `src/types/database.types.ts`

### 17.4 API Route Files (20+)
- [ ] `src/app/api/therapy-tasks/route.ts`
- [ ] `src/app/api/therapy-tasks/[id]/route.ts`
- [ ] `src/app/api/program-templates/[id]/items/route.ts`
- [ ] `src/app/api/program-templates/[id]/items/[itemId]/route.ts`
- [ ] `src/app/api/member-programs/[id]/items/route.ts`
- [ ] `src/app/api/member-programs/[id]/items/[itemId]/route.ts`
- [ ] `src/app/api/member-programs/[id]/items/batch-apply`
- [ ] `src/app/api/member-programs/[id]/tasks/route.ts`
- [ ] `src/app/api/member-programs/[id]/tasks/[taskId]/route.ts`
- [ ] `src/app/api/member-programs/[id]/schedule/route.ts`
- [ ] `src/app/api/member-programs/[id]/schedule/[scheduleId]/route.ts`
- [ ] `src/app/api/member-programs/[id]/todo/route.ts`
- [ ] `src/app/api/member-programs/[id]/todo/[taskScheduleId]/route.ts`
- [ ] `src/app/api/coordinator/script/route.ts`
- [ ] `src/app/api/coordinator/todo/route.ts`
- [ ] `src/app/api/reports/inventory-forecast/route.ts`

### 17.5 Component Files (15+)
- [ ] `src/components/forms/therapy-task-form.tsx`
- [ ] `src/components/admin/program-templates/add-template-item-form.tsx`
- [ ] `src/components/programs/add-program-item-form.tsx`
- [ ] `src/components/admin/program-templates/template-items-tab.tsx`
- [ ] `src/components/programs/program-tasks-tab.tsx`
- [ ] `src/components/programs/program-script-tab.tsx`
- [ ] `src/components/programs/program-todo-tab.tsx`
- [ ] `src/components/coordinator/script-tab.tsx`
- [ ] `src/components/coordinator/todo-tab.tsx`

---

## 18. Summary & Next Steps

### Impact Summary
- **6 database tables** require new column
- **9+ stored procedures/functions** require updates
- **20+ API endpoints** require updates
- **4 validation schemas** require updates
- **15+ UI components** require updates
- **1 type definition file** requires updates

### Recommended Next Steps

1. **Review & Approve:** Stakeholder review of this assessment
2. **Refinement:** Answer open questions (Section 15)
3. **Planning:** Create detailed tickets for each phase
4. **Development:** Begin Phase 1 (Database) after approval
5. **Iteration:** Regular check-ins during implementation

### Final Recommendation

✅ **PROCEED with implementation** following the phased approach outlined in Section 10.

**Rationale:**
- Change is well-scoped and logical
- Minimal risk to existing functionality (nullable fields)
- Clear benefits for task organization and coordination
- Aligns with existing architecture patterns
- Rollback plan is straightforward

**Estimated Effort:** 10-15 development days (2-3 weeks)
**Risk Level:** Medium (managed through phased approach and testing)

---

## Document Control

**Version:** 1.0
**Date:** October 21, 2025
**Author:** AI Assistant
**Status:** Draft - Awaiting Review
**Next Review:** After stakeholder feedback

---

**END OF ASSESSMENT**


