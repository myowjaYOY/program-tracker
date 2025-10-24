# Dashboard Page - Program Status Filtering Analysis
## Complete Deep Review

**Date**: October 24, 2025  
**Analyst**: AI Assistant  
**Scope**: All program status filtering on Dashboard page

---

## EXECUTIVE SUMMARY

The Dashboard page uses program status filtering in **3 DISTINCT LAYERS**:

1. **Dashboard Metrics API** - Uses Active/Completed status for summary cards
2. **Member Dropdown Filter** - Client-side filtering for Active + Paused programs
3. **Program Changes Tab** - Reuses Coordinator API (now Active only via ProgramStatusService)

**CRITICAL FINDING**: The Dashboard page does NOT use the `ProgramStatusService` yet. It has its own scattered status filtering logic that is INCONSISTENT with the Coordinator page.

---

## DETAILED FINDINGS

### 1. DASHBOARD PAGE COMPONENT
**File**: `src/app/dashboard/page.tsx`

#### A. Member Dropdown Filter (Lines 62, 399)
```typescript
// Line 62: Hook call
const { data: members = [], isLoading: membersLoading, error: membersError } = useDashboardMembers();

// Line 399: Description text
"Select a member to view their active or paused programs"

// Line 404-427: Member Selection Dropdown
<TextField
  select
  label="Select Member"
  fullWidth
  value={selectedMember?.lead_id || ''}
  onChange={(e) => {
    const memberId = Number(e.target.value);
    const member = members.find(m => m.lead_id === memberId);
    handleMemberChange(null, member);
  }}
  disabled={membersLoading}
>
  <MenuItem value="">
    <em>Choose a member...</em>
  </MenuItem>
  {members.map((member) => (
    <MenuItem key={member.lead_id} value={member.lead_id}>
      {member.lead_name}
    </MenuItem>
  ))}
</TextField>
```

**Status Filtering**: Active + Paused programs only  
**Location**: Client-side filtering in `useDashboardMembers` hook  
**Consistency**: ❌ INCONSISTENT - Uses Active + Paused, while Coordinator now uses Active only

---

### 2. DASHBOARD METRICS API
**File**: `src/app/api/dashboard/metrics/route.ts`

#### A. Active Members Metric (Lines 38-54)
```typescript
// 1. Active Members
let activeMembers = 0;
if (activeStatusId) {
  const { data: activePrograms, error: activeProgramsErr } = await supabase
    .from('member_programs')
    .select('lead_id')
    .eq('program_status_id', activeStatusId);

  if (activeProgramsErr) {
    console.error('Error fetching active programs:', activeProgramsErr);
  } else {
    const uniqueLeadIds = new Set(
      activePrograms.map(p => p.lead_id).filter(Boolean)
    );
    activeMembers = uniqueLeadIds.size;
  }
}
```

**Status Filtering**: Active programs only  
**Method**: Manual status lookup and filtering  
**Uses ProgramStatusService**: ❌ NO

#### B. New Programs This Month (Lines 56-68)
```typescript
// 2. New Programs This Month
const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
const endOfMonth = new Date(currentYear, currentMonth, 0);

const { count: newProgramsThisMonth, error: newProgramsErr } = await supabase
  .from('member_programs')
  .select('*', { count: 'exact', head: true })
  .gte('start_date', startOfMonth.toISOString().slice(0, 10))
  .lte('start_date', endOfMonth.toISOString().slice(0, 10));
```

**Status Filtering**: ❌ NONE - Counts ALL programs regardless of status  
**Issue**: This is counting Quote, Cancelled, and Completed programs as "new"  
**Uses ProgramStatusService**: ❌ NO

#### C. Completed Programs (Lines 70-83)
```typescript
// 3. Completed Programs
let completedPrograms = 0;
if (completedStatusId) {
  const { count, error: completedProgramsErr } = await supabase
    .from('member_programs')
    .select('*', { count: 'exact', head: true })
    .eq('program_status_id', completedStatusId);

  if (completedProgramsErr) {
    console.error('Error fetching completed programs:', completedProgramsErr);
  } else {
    completedPrograms = count || 0;
  }
}
```

**Status Filtering**: Completed programs only  
**Method**: Manual status lookup and filtering  
**Uses ProgramStatusService**: ❌ NO

#### D. Program Changes This Week (Lines 61, 364)
```typescript
// Line 61: Hook call
const { data: coordinatorMetrics } = useCoordinatorMetrics();

// Line 364: Display
{coordinatorMetrics?.programChangesThisWeek ?? 0}
```

**Status Filtering**: ✅ Active programs only (via ProgramStatusService in Coordinator API)  
**Method**: Reuses Coordinator metrics API  
**Uses ProgramStatusService**: ✅ YES (indirectly via `/api/coordinator/metrics`)

---

### 3. DASHBOARD MEMBER PROGRAMS HOOK
**File**: `src/lib/hooks/use-dashboard-member-programs.ts`

#### A. useDashboardMembers Hook (Lines 51-99)
```typescript
export function useDashboardMembers() {
  return useQuery<DashboardMember[], Error>({
    queryKey: dashboardMemberProgramKeys.members(),
    queryFn: async () => {
      const res = await fetch('/api/member-programs', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch member programs');
      }
      
      const allPrograms = json.data as MemberPrograms[];
      
      // Filter for Active and Paused programs only
      const filteredPrograms = allPrograms.filter(program => {
        const statusName = program.status_name?.toLowerCase();
        return statusName === 'active' || statusName === 'paused';
      });
      
      // Group programs by lead (member)
      const memberMap = new Map<number, DashboardMember>();
      
      filteredPrograms.forEach(program => {
        if (!program.lead_id || !program.lead_name) return;
        
        const leadId = program.lead_id;
        
        if (!memberMap.has(leadId)) {
          memberMap.set(leadId, {
            lead_id: leadId,
            lead_name: program.lead_name,
            lead_email: program.lead_email || null,
            programs: [],
          });
        }
        
        memberMap.get(leadId)!.programs.push(program);
      });
      
      // Convert map to array and sort by lead name
      const members = Array.from(memberMap.values()).sort((a, b) => 
        a.lead_name.localeCompare(b.lead_name)
      );
      
      return members;
    },
  });
}
```

**Status Filtering**: Active + Paused programs only  
**Method**: Client-side filtering after fetching ALL programs  
**API Called**: `/api/member-programs` (returns ALL programs)  
**Uses ProgramStatusService**: ❌ NO  
**Issue**: Fetches all programs then filters client-side (inefficient)

---

### 4. DASHBOARD TAB COMPONENTS

#### A. Program Info Tab
**File**: `src/components/dashboard/dashboard-program-info-tab.tsx`  
**Status Filtering**: ❌ NONE - Displays selected program regardless of status  
**Reason**: Intentional - user already selected a specific program

#### B. Program Items Tab
**File**: `src/components/dashboard/dashboard-program-items-tab.tsx`  
**API Called**: `/api/member-programs/${programId}/items` (via `useMemberProgramItems`)  
**Status Filtering**: ❌ NONE - Shows items for selected program regardless of status  
**Reason**: Intentional - user already selected a specific program

#### C. Program Notes Tab
**File**: `src/components/dashboard/dashboard-program-notes-tab.tsx`  
**Status Filtering**: ❌ NONE - Shows notes for selected member  
**Reason**: Intentional - notes are member-level, not program-level

#### D. Program Script Tab
**File**: `src/components/dashboard/dashboard-program-script-tab.tsx`  
**Component**: Wrapper for `ProgramScriptTab`  
**API Called**: `/api/member-programs/${programId}/schedule` (via `useProgramSchedule`)  
**Status Filtering**: ❌ NONE - Shows schedule for selected program regardless of status  
**Reason**: Intentional - user already selected a specific program

**API Route**: `src/app/api/member-programs/[id]/schedule/route.ts`  
- Lines 20-32: Fetches items for the program
- Lines 34-46: Fetches schedule rows for those items
- **No status filtering** - assumes program ID is valid

#### E. Program To Do Tab
**File**: `src/components/dashboard/dashboard-program-todo-tab.tsx`  
**Component**: Wrapper for `ProgramToDoTab`  
**API Called**: `/api/member-programs/${programId}/todo` (via `useProgramToDo`)  
**Status Filtering**: ❌ NONE - Shows tasks for selected program regardless of status  
**Reason**: Intentional - user already selected a specific program

**API Route**: `src/app/api/member-programs/[id]/todo/route.ts`  
- Lines 21-32: Fetches items for the program
- Lines 34-45: Fetches schedule IDs
- Lines 47-71: Fetches task schedule rows
- **No status filtering** - assumes program ID is valid

#### F. Program Changes Tab
**File**: Dashboard reuses `ProgramChangesTab` from Coordinator  
**API Called**: `/api/coordinator/program-changes` (via `useCoordinatorProgramChanges`)  
**Status Filtering**: ✅ Active programs only (via ProgramStatusService)  
**Uses ProgramStatusService**: ✅ YES

---

## COMPARISON: COORDINATOR vs DASHBOARD

| Feature | Coordinator Page | Dashboard Page | Consistent? |
|---------|-----------------|----------------|-------------|
| **Member Dropdown** | Active only | Active + Paused | ❌ NO |
| **Metrics API** | Active only (via Service) | Manual Active/Completed | ❌ NO |
| **Script Tab** | Active only (via Service) | No filtering (program-specific) | ⚠️ Different purpose |
| **To Do Tab** | Active only (via Service) | No filtering (program-specific) | ⚠️ Different purpose |
| **Program Changes** | Active only (via Service) | Active only (via Service) | ✅ YES |
| **Uses ProgramStatusService** | ✅ YES | ❌ NO (except Program Changes) | ❌ NO |

---

## ISSUES IDENTIFIED

### 🔴 CRITICAL ISSUES

1. **Inconsistent Member Dropdown**
   - **Coordinator**: Shows members with Active programs only
   - **Dashboard**: Shows members with Active + Paused programs
   - **Impact**: Users see different member lists on different pages

2. **New Programs This Month - No Status Filter**
   - **Current**: Counts ALL programs (including Quote, Cancelled, Completed)
   - **Expected**: Should probably count Active programs only, or at least exclude Quote/Cancelled
   - **Impact**: Misleading metric - inflated numbers

3. **No Use of ProgramStatusService**
   - **Current**: Dashboard has its own manual status filtering logic
   - **Expected**: Should use centralized `ProgramStatusService` for consistency
   - **Impact**: Maintenance burden, inconsistency, potential bugs

### ⚠️ DESIGN QUESTIONS

4. **Client-Side vs API-Level Filtering**
   - **Current**: `useDashboardMembers` fetches ALL programs then filters client-side
   - **Alternative**: Could use ProgramStatusService at API level for efficiency
   - **Impact**: Performance - fetching unnecessary data

5. **Program-Specific Tabs (Script, To Do, Items)**
   - **Current**: No status filtering - shows data for any selected program
   - **Question**: Should these tabs refuse to show data for Cancelled/Completed programs?
   - **Current Behavior**: Seems intentional - user explicitly selected the program

---

## RECOMMENDATIONS

### OPTION A: STRICT CONSISTENCY (Recommended)
**Goal**: Make Dashboard identical to Coordinator

1. **Update Member Dropdown to Active Only**
   - Modify `useDashboardMembers` to filter Active only
   - Update description text from "active or paused" to "active"
   - **Rationale**: Matches Coordinator, uses ProgramStatusService logic

2. **Update Dashboard Metrics API**
   - Implement `ProgramStatusService` for Active Members metric
   - Add status filtering to New Programs This Month (Active only)
   - Keep Completed Programs as-is (intentionally shows Completed)
   - **Rationale**: Centralized logic, consistent behavior

3. **Keep Program-Specific Tabs As-Is**
   - Script, To Do, Items tabs continue to show data for selected program
   - **Rationale**: User explicitly selected the program, should see its data regardless of status

### OPTION B: FLEXIBLE APPROACH
**Goal**: Allow Dashboard to have different business rules

1. **Keep Member Dropdown as Active + Paused**
   - Document this as intentional difference from Coordinator
   - **Rationale**: Dashboard is for viewing any program, Coordinator is for active work

2. **Update Metrics API to Use ProgramStatusService**
   - Still use centralized service, but request `includeStatuses: ['paused']` where needed
   - **Rationale**: Centralized logic, but flexible rules per context

3. **Add Status Filter to New Programs This Month**
   - Exclude Quote and Cancelled at minimum
   - **Rationale**: More accurate metric

### OPTION C: HYBRID (Most Pragmatic)
**Goal**: Fix critical issues, defer design questions

1. **Fix New Programs This Month**
   - Add status filtering to exclude Quote and Cancelled
   - **Priority**: HIGH - This is clearly a bug

2. **Align Member Dropdown with Coordinator**
   - Change to Active only for consistency
   - **Priority**: MEDIUM - Reduces user confusion

3. **Implement ProgramStatusService in Dashboard Metrics API**
   - Replace manual status lookups with service calls
   - **Priority**: MEDIUM - Improves maintainability

4. **Keep Program-Specific Tabs As-Is**
   - No changes needed
   - **Priority**: LOW - Current behavior seems intentional

---

## IMPLEMENTATION PLAN (OPTION C - HYBRID)

### Phase 1: Fix Critical Bug
**File**: `src/app/api/dashboard/metrics/route.ts`

```typescript
// BEFORE (Lines 56-68):
const { count: newProgramsThisMonth, error: newProgramsErr } = await supabase
  .from('member_programs')
  .select('*', { count: 'exact', head: true })
  .gte('start_date', startOfMonth.toISOString().slice(0, 10))
  .lte('start_date', endOfMonth.toISOString().slice(0, 10));

// AFTER:
// Get valid status IDs (exclude Quote and Cancelled at minimum)
const validStatusIds = await ProgramStatusService.getValidStatusIds(supabase, {
  includeStatuses: ['paused', 'completed'] // Include Active, Paused, Completed
});

const { count: newProgramsThisMonth, error: newProgramsErr } = await supabase
  .from('member_programs')
  .select('*', { count: 'exact', head: true })
  .gte('start_date', startOfMonth.toISOString().slice(0, 10))
  .lte('start_date', endOfMonth.toISOString().slice(0, 10))
  .in('program_status_id', validStatusIds);
```

### Phase 2: Implement ProgramStatusService
**File**: `src/app/api/dashboard/metrics/route.ts`

```typescript
// BEFORE (Lines 38-54):
const activeStatusId = statuses?.find(
  s => s.status_name?.toLowerCase() === 'active'
)?.program_status_id;

let activeMembers = 0;
if (activeStatusId) {
  const { data: activePrograms, error: activeProgramsErr } = await supabase
    .from('member_programs')
    .select('lead_id')
    .eq('program_status_id', activeStatusId);
  
  const uniqueLeadIds = new Set(
    activePrograms.map(p => p.lead_id).filter(Boolean)
  );
  activeMembers = uniqueLeadIds.size;
}

// AFTER:
const activeProgramIds = await ProgramStatusService.getValidProgramIds(supabase);

const { data: activePrograms, error: activeProgramsErr } = await supabase
  .from('member_programs')
  .select('lead_id')
  .in('member_program_id', activeProgramIds);

if (activeProgramsErr) {
  console.error('Error fetching active programs:', activeProgramsErr);
} else {
  const uniqueLeadIds = new Set(
    (activePrograms || []).map(p => p.lead_id).filter(Boolean)
  );
  activeMembers = uniqueLeadIds.size;
}
```

### Phase 3: Align Member Dropdown
**File**: `src/lib/hooks/use-dashboard-member-programs.ts`

```typescript
// BEFORE (Lines 66-69):
// Filter for Active and Paused programs only
const filteredPrograms = allPrograms.filter(program => {
  const statusName = program.status_name?.toLowerCase();
  return statusName === 'active' || statusName === 'paused';
});

// AFTER:
// Filter for Active programs only (matching Coordinator logic)
const filteredPrograms = allPrograms.filter(program => {
  const statusName = program.status_name?.toLowerCase();
  return statusName === 'active';
});
```

**File**: `src/app/dashboard/page.tsx`

```typescript
// BEFORE (Line 399):
"Select a member to view their active or paused programs"

// AFTER:
"Select a member to view their active programs"
```

---

## FILES REQUIRING CHANGES

### Must Change (Phase 1 - Critical Bug Fix)
1. `src/app/api/dashboard/metrics/route.ts` - Add status filtering to New Programs metric

### Should Change (Phase 2 - Consistency)
2. `src/app/api/dashboard/metrics/route.ts` - Implement ProgramStatusService for Active Members
3. `src/lib/hooks/use-dashboard-member-programs.ts` - Change to Active only
4. `src/app/dashboard/page.tsx` - Update description text

### No Changes Needed
- `src/app/api/member-programs/[id]/schedule/route.ts` - Program-specific, no status filter needed
- `src/app/api/member-programs/[id]/todo/route.ts` - Program-specific, no status filter needed
- All dashboard tab components - Already working as intended

---

## TESTING CHECKLIST

### After Implementation
- [ ] Dashboard Metrics API returns correct Active Members count
- [ ] New Programs This Month excludes Quote/Cancelled programs
- [ ] Completed Programs count remains accurate
- [ ] Member dropdown shows only Active program members (matching Coordinator)
- [ ] Selected member's programs display correctly in dropdown
- [ ] All 6 tabs (Program, Items, Notes, Script, To Do, Changes) load correctly
- [ ] Program Changes tab shows Active programs only
- [ ] No console errors
- [ ] Performance is acceptable (no slow queries)

---

## CONCLUSION

The Dashboard page currently has **SCATTERED and INCONSISTENT** program status filtering logic:

- ✅ **Program Changes tab**: Uses ProgramStatusService (Active only)
- ❌ **Member Dropdown**: Client-side filtering (Active + Paused)
- ❌ **Metrics API**: Manual status lookups (Active, Completed, NO FILTER for New Programs)
- ⚠️ **Program-Specific Tabs**: No filtering (intentional - user selected program)

**RECOMMENDED ACTION**: Implement **OPTION C (HYBRID)** to:
1. Fix the critical bug (New Programs metric)
2. Implement ProgramStatusService for consistency
3. Align Member Dropdown with Coordinator
4. Keep program-specific tabs as-is (working as intended)

This approach balances **correctness**, **consistency**, and **pragmatism**.

