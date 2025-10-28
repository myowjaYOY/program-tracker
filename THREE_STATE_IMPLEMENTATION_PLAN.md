# Three-State Status Implementation Plan

## 🔍 **FINDINGS**

### **Database Function Analysis**
The `generate_member_program_schedule` function does **NOT** explicitly set `completed_flag`.

```sql
INSERT INTO public.member_program_item_schedule(
  member_program_item_id,
  instance_number,
  scheduled_date,
  program_role_id
)
VALUES (...);
-- ↑ No completed_flag specified → Uses table DEFAULT
```

**Current table DEFAULT:**
```sql
completed_flag boolean NOT NULL DEFAULT false  ❌
```

**Result:** All new schedule items are created with `completed_flag = false`

---

## ✅ **IMPLEMENTATION CHECKLIST**

### **Phase 1: Database Changes** (15 min)

#### **1.1 Create Migration File**
```sql
-- migrations/20251028_three_state_schedule_status.sql

BEGIN;

-- ========================================
-- Step 1: Allow NULL for item schedules
-- ========================================
ALTER TABLE member_program_item_schedule 
  ALTER COLUMN completed_flag DROP NOT NULL,
  ALTER COLUMN completed_flag SET DEFAULT NULL;

-- ========================================
-- Step 2: Allow NULL for task schedules
-- ========================================
ALTER TABLE member_program_items_task_schedule 
  ALTER COLUMN completed_flag DROP NOT NULL,
  ALTER COLUMN completed_flag SET DEFAULT NULL;

-- ========================================
-- Step 3: Backfill existing data
-- ========================================

-- Convert all existing false values to NULL (pending)
-- Rationale: "false" doesn't mean "missed" - it means "not yet decided"
UPDATE member_program_item_schedule
SET completed_flag = NULL
WHERE completed_flag = false;

UPDATE member_program_items_task_schedule
SET completed_flag = NULL
WHERE completed_flag = false;

-- Keep true values as-is (already redeemed)
-- (No action needed)

COMMIT;

-- ========================================
-- Verification Queries
-- ========================================
SELECT 
  COUNT(*) FILTER (WHERE completed_flag = true) as redeemed_count,
  COUNT(*) FILTER (WHERE completed_flag = false) as missed_count,
  COUNT(*) FILTER (WHERE completed_flag IS NULL) as pending_count,
  COUNT(*) as total
FROM member_program_item_schedule;

SELECT 
  COUNT(*) FILTER (WHERE completed_flag = true) as redeemed_count,
  COUNT(*) FILTER (WHERE completed_flag = false) as missed_count,
  COUNT(*) FILTER (WHERE completed_flag IS NULL) as pending_count,
  COUNT(*) as total
FROM member_program_items_task_schedule;
```

#### **1.2 Apply Migration**
```bash
supabase db push
```

**Result:** 
- ✅ New items will be created with `completed_flag = NULL` (pending)
- ✅ Existing incomplete items converted to NULL (pending)
- ✅ Existing completed items stay as `true` (redeemed)

---

### **Phase 2: TypeScript Types** (5 min)

#### **2.1 Update Database Types**
```typescript
// src/types/database.types.ts

export interface MemberProgramItemSchedule {
  member_program_item_schedule_id: number;
  member_program_item_id: number;
  instance_number: number;
  scheduled_date: string | null;
  completed_flag: boolean | null;  // ← Changed from boolean
  program_role_id: number | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface MemberProgramItemTaskSchedule {
  member_program_item_task_schedule_id: number;
  member_program_item_schedule_id: number;
  member_program_item_task_id: number;
  due_date: string | null;
  completed_flag: boolean | null;  // ← Changed from boolean
  program_role_id: number | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}
```

---

### **Phase 3: Utility Functions** (5 min)

#### **3.1 Create Status Utility**
```typescript
// src/lib/utils/schedule-status.ts

export type ScheduleItemStatus = 'redeemed' | 'missed' | 'pending';

/**
 * Get status from completed_flag value
 * - true = Redeemed (therapy completed)
 * - false = Missed (therapy did not happen - refused/cancelled)
 * - null = Pending (no decision made yet)
 */
export function getScheduleStatus(completed_flag: boolean | null): ScheduleItemStatus {
  if (completed_flag === true) return 'redeemed';
  if (completed_flag === false) return 'missed';
  return 'pending';
}

/**
 * Get next status in cycle: pending → redeemed → missed → pending
 */
export function getNextStatus(current: boolean | null): boolean | null {
  if (current === null) return true;   // pending → redeemed
  if (current === true) return false;  // redeemed → missed
  return null;                         // missed → pending
}

/**
 * Status configuration for UI rendering
 */
export const STATUS_CONFIG = {
  redeemed: {
    label: 'Redeemed',
    color: 'success' as const,
    chipColor: '#10b981',
    description: 'Therapy completed',
  },
  missed: {
    label: 'Missed',
    color: 'error' as const,
    chipColor: '#ef4444',
    description: 'Therapy did not happen',
  },
  pending: {
    label: 'Pending',
    color: 'default' as const,
    chipColor: '#9ca3af',
    description: 'No decision made',
  },
} as const;
```

---

### **Phase 4: API Route Updates** (20 min)

#### **4.1 Coordinator Script API**
```typescript
// src/app/api/coordinator/script/route.ts

// BEFORE (line 72):
if (!showCompleted) {
  schedQuery = schedQuery.eq('completed_flag', false);
}

// AFTER:
if (showCompleted) {
  // Show only redeemed items
  schedQuery = schedQuery.eq('completed_flag', true);
} else {
  // Show pending AND missed (not redeemed)
  schedQuery = schedQuery.or('completed_flag.is.null,completed_flag.eq.false');
}
```

#### **4.2 Coordinator To Do API**
```typescript
// src/app/api/coordinator/todo/route.ts

// Similar change around line 100+
if (showCompleted) {
  query = query.eq('completed_flag', true);
} else {
  query = query.or('completed_flag.is.null,completed_flag.eq.false');
}
```

#### **4.3 Update Schedule Item API**
```typescript
// src/app/api/member-programs/[id]/schedule/[scheduleId]/route.ts
// (validation already exists, just verify it handles null)

export async function PUT(req: NextRequest, context: any) {
  const body = await req.json();
  const { completed_flag } = body;
  
  // Allow true, false, or null
  if (completed_flag !== true && 
      completed_flag !== false && 
      completed_flag !== null) {
    return NextResponse.json(
      { error: 'completed_flag must be true, false, or null' },
      { status: 400 }
    );
  }
  
  // Rest of update logic...
}
```

#### **4.4 Update Task Schedule API**
```typescript
// src/app/api/member-programs/[id]/todo/[taskScheduleId]/route.ts
// Same validation as above
```

---

### **Phase 5: UI Component - Status Chip** (15 min)

#### **5.1 Create Reusable StatusChip Component**
```tsx
// src/components/ui/schedule-status-chip.tsx

'use client';

import { Chip, Tooltip } from '@mui/material';
import {
  CheckCircle as RedeemedIcon,
  Cancel as MissedIcon,
  RadioButtonUnchecked as PendingIcon,
} from '@mui/icons-material';
import { getScheduleStatus, getNextStatus, STATUS_CONFIG } from '@/lib/utils/schedule-status';

interface ScheduleStatusChipProps {
  completed_flag: boolean | null;
  onStatusChange: (newValue: boolean | null) => void;
  readOnly?: boolean;
}

export default function ScheduleStatusChip({
  completed_flag,
  onStatusChange,
  readOnly = false,
}: ScheduleStatusChipProps) {
  const status = getScheduleStatus(completed_flag);
  const config = STATUS_CONFIG[status];
  
  const handleClick = () => {
    if (readOnly) return;
    const nextValue = getNextStatus(completed_flag);
    onStatusChange(nextValue);
  };
  
  const nextStatus = getScheduleStatus(getNextStatus(completed_flag));
  const nextLabel = STATUS_CONFIG[nextStatus].label;
  const tooltipText = readOnly 
    ? config.description 
    : `Click to mark as ${nextLabel}`;
  
  const IconComponent = 
    status === 'redeemed' ? RedeemedIcon :
    status === 'missed' ? MissedIcon :
    PendingIcon;
  
  return (
    <Tooltip title={tooltipText}>
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        icon={<IconComponent sx={{ fontSize: 16 }} />}
        onClick={handleClick}
        sx={{ 
          cursor: readOnly ? 'default' : 'pointer',
          '&:hover': readOnly ? {} : {
            opacity: 0.8,
          },
        }}
      />
    </Tooltip>
  );
}
```

---

### **Phase 6: Update Coordinator Script Tab** (15 min)

```tsx
// src/components/coordinator/script-tab.tsx

import ScheduleStatusChip from '@/components/ui/schedule-status-chip';

// CHANGE 1: Update column definition (around line 245)
{
  field: 'completed_flag',
  headerName: 'Redeemed',  // ← Changed from 'Completed'
  width: 130,
  renderCell: params => {
    const row = params.row as any as Row;
    const readOnly =
      (row.program_status_name || '').toLowerCase() !== 'active';
    return (
      <ScheduleStatusChip
        completed_flag={row.completed_flag}
        onStatusChange={(newValue) => toggleComplete(row, newValue)}
        readOnly={readOnly}
      />
    );
  },
},

// CHANGE 2: Update toggleComplete function signature (around line 75)
const toggleComplete = async (row: Row, newValue: boolean | null) => {
  const scheduleId = row.member_program_item_schedule_id;
  
  // Build query key
  const sp = new URLSearchParams();
  if (memberId) sp.set('memberId', String(memberId));
  if (range && range !== 'all') sp.set('range', range);
  if (start) sp.set('start', start);
  if (end) sp.set('end', end);
  if (showCompleted) sp.set('showCompleted', 'true');
  const queryKey = coordinatorKeys.script(sp.toString());

  // Optimistic update
  qc.setQueryData(queryKey, (oldData: any) => {
    if (!oldData) return oldData;
    
    if (showCompleted) {
      // Just update the value
      return oldData.map((item: any) =>
        item.member_program_item_schedule_id === scheduleId
          ? { ...item, completed_flag: newValue }
          : item
      );
    } else {
      // If marking as redeemed, remove from incomplete list
      if (newValue === true) {
        return oldData.filter((item: any) => 
          item.member_program_item_schedule_id !== scheduleId
        );
      }
      // Otherwise just update
      return oldData.map((item: any) =>
        item.member_program_item_schedule_id === scheduleId
          ? { ...item, completed_flag: newValue }
          : item
      );
    }
  });

  try {
    // API call
    const response = await fetch(`/api/coordinator/script/${scheduleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_flag: newValue }),
    });

    if (!response.ok) throw new Error('Failed to update');

    // Invalidate and refetch
    await qc.invalidateQueries({ 
      queryKey, 
      refetchType: 'active' 
    });
    await qc.invalidateQueries({ 
      queryKey: coordinatorKeys.metrics(),
      refetchType: 'active'
    });
    
    toast.success('Status updated successfully');
  } catch (error) {
    qc.invalidateQueries({ queryKey });
    toast.error('Failed to update status');
  }
};

// CHANGE 3: Update getRowClassName (around line 315)
function getRowClassName(params: any): string {
  const row = params.row;
  
  // If decision made (not null), no color
  if (row.completed_flag !== null) return '';
  
  // Only pending items (null) get date-based coloring
  if (!row.scheduled_date) return '';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const schedDate = new Date(row.scheduled_date);
  schedDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor(
    (schedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (diffDays < 0) return 'row-late';
  if (diffDays <= 7) return 'row-soon';
  return '';
}
```

---

### **Phase 7: Update Coordinator To Do Tab** (15 min)

```tsx
// src/components/coordinator/todo-tab.tsx

import ScheduleStatusChip from '@/components/ui/schedule-status-chip';

// CHANGE 1: Update column definition (around line 232)
{
  field: 'completed_flag',
  headerName: 'Redeemed',  // ← Changed from 'Completed'
  width: 130,
  renderCell: params => {
    const row: any = params.row;
    const readOnly =
      (row.program_status_name || '').toLowerCase() !== 'active';
    return (
      <ScheduleStatusChip
        completed_flag={row.completed_flag}
        onStatusChange={(newValue) => toggleComplete(row, newValue)}
        readOnly={readOnly}
      />
    );
  },
},

// CHANGE 2: Update toggleComplete function (around line 70)
const toggleComplete = async (row: any, newValue: boolean | null) => {
  const taskScheduleId = row.member_program_item_task_schedule_id;
  
  // Build query key
  const sp = new URLSearchParams();
  if (memberId) sp.set('memberId', String(memberId));
  if (range && range !== 'all') sp.set('range', range);
  if (start) sp.set('start', start);
  if (end) sp.set('end', end);
  if (showCompleted) sp.set('showCompleted', 'true');
  const queryKey = coordinatorKeys.todo(sp.toString());

  // Optimistic update
  qc.setQueryData(queryKey, (oldData: any) => {
    if (!oldData) return oldData;
    
    if (showCompleted) {
      return oldData.map((item: any) =>
        item.member_program_item_task_schedule_id === taskScheduleId
          ? { ...item, completed_flag: newValue }
          : item
      );
    } else {
      if (newValue === true) {
        return oldData.filter((item: any) => 
          item.member_program_item_task_schedule_id !== taskScheduleId
        );
      }
      return oldData.map((item: any) =>
        item.member_program_item_task_schedule_id === taskScheduleId
          ? { ...item, completed_flag: newValue }
          : item
      );
    }
  });

  try {
    const url = `/api/member-programs/${row.member_program_id}/todo/${taskScheduleId}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_flag: newValue }),
    });
    
    if (!res.ok) throw new Error('Failed to update');
    
    await qc.invalidateQueries({ 
      queryKey, 
      refetchType: 'active' 
    });
    await qc.invalidateQueries({ 
      queryKey: coordinatorKeys.metrics(),
      refetchType: 'active'
    });
    
    toast.success('Status updated successfully');
  } catch (error) {
    qc.invalidateQueries({ queryKey });
    toast.error('Failed to update status');
  }
};

// CHANGE 3: Update getRowClassName (around line 320)
function getRowClassName(params: any): string {
  const row = params.row;
  
  // If decision made (not null), no color
  if (row.completed_flag !== null) return '';
  
  // Only pending items (null) get date-based coloring
  if (!row.due_date) return '';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(row.due_date);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (diffDays < 0) return 'row-late';
  return '';
}
```

---

### **Phase 8: Update Program Script Tab (Read-Only)** (5 min)

```tsx
// src/components/programs/program-script-tab.tsx

import { getScheduleStatus, STATUS_CONFIG } from '@/lib/utils/schedule-status';
import { Chip } from '@mui/material';
import {
  CheckCircle as RedeemedIcon,
  Cancel as MissedIcon,
  RadioButtonUnchecked as PendingIcon,
} from '@mui/icons-material';

// Update column definition (around line 62)
{
  field: 'completed_flag',
  headerName: 'Redeemed',  // ← Changed from 'Completed'
  width: 130,
  renderCell: params => {
    const row: any = params.row;
    const status = getScheduleStatus(row.completed_flag);
    const config = STATUS_CONFIG[status];
    
    const IconComponent = 
      status === 'redeemed' ? RedeemedIcon :
      status === 'missed' ? MissedIcon :
      PendingIcon;
    
    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        icon={<IconComponent sx={{ fontSize: 16 }} />}
      />
    );
  },
},
```

---

### **Phase 9: Update Zod Validations** (5 min)

```typescript
// src/lib/validations/member-program-item-schedule.ts

export const memberProgramItemScheduleUpdateSchema = z.object({
  completed_flag: z.boolean().nullable().optional(),  // ← Changed
  scheduled_date: z.string().optional(),
});
```

```typescript
// src/lib/validations/member-program-item-task-schedule.ts

export const memberProgramItemTaskScheduleUpdateSchema = z.object({
  completed_flag: z.boolean().nullable().optional(),  // ← Changed
  due_date: z.string().optional(),
});
```

---

## 📋 **COMPLETE FILE LIST**

### **New Files (2)**
- [ ] `migrations/20251028_three_state_schedule_status.sql`
- [ ] `src/lib/utils/schedule-status.ts`
- [ ] `src/components/ui/schedule-status-chip.tsx`

### **Modified Files (10)**
- [ ] `src/types/database.types.ts`
- [ ] `src/app/api/coordinator/script/route.ts`
- [ ] `src/app/api/coordinator/todo/route.ts`
- [ ] `src/app/api/member-programs/[id]/schedule/[scheduleId]/route.ts`
- [ ] `src/app/api/member-programs/[id]/todo/[taskScheduleId]/route.ts`
- [ ] `src/components/coordinator/script-tab.tsx`
- [ ] `src/components/coordinator/todo-tab.tsx`
- [ ] `src/components/programs/program-script-tab.tsx`
- [ ] `src/lib/validations/member-program-item-schedule.ts`
- [ ] `src/lib/validations/member-program-item-task-schedule.ts`

**Total: 13 files (3 new, 10 modified)**

---

## ⏱️ **ESTIMATED TIME**

| Phase | Time |
|-------|------|
| Database Migration | 15 min |
| TypeScript Types | 5 min |
| Utility Functions | 5 min |
| API Routes | 20 min |
| Status Chip Component | 15 min |
| Coordinator Script Tab | 15 min |
| Coordinator To Do Tab | 15 min |
| Program Script Tab | 5 min |
| Zod Validations | 5 min |
| **Testing** | 30 min |
| **TOTAL** | **~2 hours** |

---

## 🧪 **TESTING CHECKLIST**

### **Database**
- [ ] Migration runs without errors
- [ ] Verify all existing `false` converted to `NULL`
- [ ] Verify all `true` stayed as `true`
- [ ] Create new schedule item → `completed_flag = NULL`

### **UI - Script Tab**
- [ ] Column header shows "Redeemed"
- [ ] Pending items show gray chip with ⭕ icon
- [ ] Click pending → changes to redeemed (green ✅)
- [ ] Click redeemed → changes to missed (red ❌)
- [ ] Click missed → changes to pending (gray ⭕)
- [ ] Read-only programs can't click chip
- [ ] Tooltip shows next status

### **UI - To Do Tab**
- [ ] Column header shows "Redeemed"
- [ ] Same chip behavior as Script Tab
- [ ] Icons and colors correct

### **UI - Row Colors**
- [ ] Pending item past due → RED row
- [ ] Pending item due soon → LIGHT RED row
- [ ] Redeemed item → WHITE row (even if past due)
- [ ] Missed item → WHITE row (even if past due)

### **API**
- [ ] PUT with `null` works
- [ ] PUT with `true` works
- [ ] PUT with `false` works
- [ ] Filter "Show Completed" works

### **Edge Cases**
- [ ] Generate schedule creates items with `NULL`
- [ ] Optimistic updates work correctly
- [ ] Cache invalidation works
- [ ] Metrics update correctly

---

## 🚀 **DEPLOYMENT STEPS**

1. ✅ Apply database migration
2. ✅ Deploy code changes
3. ✅ Test in production
4. ✅ Monitor for errors
5. ✅ Notify users of new feature

---

**Ready to implement! Should I proceed?** 🎯

