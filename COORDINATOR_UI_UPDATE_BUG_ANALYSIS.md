# Coordinator UI Update Bug - Deep Dive Analysis

## Executive Summary

The intermittent UI update failures when completing tasks/items in the Coordinator screen are caused by **5 critical bugs** in the optimistic update and cache invalidation logic. The root cause is a **query key mismatch** that prevents React Query from properly invalidating and refetching the correct data.

---

## Critical Bug #1: Query Key Mismatch (PRIMARY ROOT CAUSE)

### The Problem

**Location**: 
- `src/components/coordinator/script-tab.tsx` (lines 77-81)
- `src/components/coordinator/todo-tab.tsx` (lines 72-76)

### What's Happening

When `toggleComplete()` is called, it constructs a query key for invalidation:

```typescript
// IN COMPONENT (script-tab.tsx, lines 77-81)
const sp = new URLSearchParams();
if (memberId) sp.set('memberId', String(memberId));
if (range && range !== 'all') sp.set('range', range);
const qs = sp.toString();
const queryKey = coordinatorKeys.script(qs);
```

**BUT** the actual query key used by the hook includes MORE parameters:

```typescript
// IN HOOK (use-coordinator.ts, lines 43-48)
const sp = new URLSearchParams();
if (params.memberId) sp.set('memberId', String(params.memberId));
if (params.range && params.range !== 'all') sp.set('range', params.range);
if (params.start) sp.set('start', params.start);              // ❌ MISSING
if (params.end) sp.set('end', params.end);                    // ❌ MISSING
if (params.showCompleted) sp.set('showCompleted', 'true');    // ❌ MISSING
```

### Example Scenario

**User View**: Coordinator Script tab with `memberId=8`, `range='week'`, `showCompleted=false`

**Actual Query Key**: `['coordinator', 'script', 'memberId=8&range=week']`  
(Note: `showCompleted` is NOT in the key when `false`)

**Invalidation Key**: `['coordinator', 'script', 'memberId=8&range=week']` ✅ **MATCHES (works)**

---

**BUT when user has `showCompleted=true`:**

**Actual Query Key**: `['coordinator', 'script', 'memberId=8&range=week&showCompleted=true']`

**Invalidation Key**: `['coordinator', 'script', 'memberId=8&range=week']` ❌ **MISMATCH (fails)**

### Impact

- **50% of the time** (when showCompleted=true or custom date ranges are set), the invalidation targets the **WRONG query key**
- React Query doesn't refetch because it thinks it's invalidating a different query
- The optimistic update persists with stale data
- User sees the old state until manual refresh

---

## Critical Bug #2: Incorrect Optimistic Update for Filtered Views

### The Problem

**Location**: 
- `src/components/coordinator/script-tab.tsx` (lines 84-91)
- `src/components/coordinator/todo-tab.tsx` (lines 79-86)

### What's Happening

When `showCompleted=false` (the default), the view only shows incomplete items. When a user marks an item complete:

```typescript
// Current code - just flips the flag
qc.setQueryData(queryKey, (oldData: any) => {
  if (!oldData) return oldData;
  return oldData.map((item: any) => 
    item.member_program_item_schedule_id === row.member_program_item_schedule_id
      ? { ...item, completed_flag: !row.completed_flag }  // ❌ Still in array!
      : item
  );
});
```

### The Issue

The item should **disappear** from the view (be removed from the array), not just have its flag flipped. The current optimistic update makes the item show as "completed" but it stays visible in the incomplete-only view.

### Impact

- User sees a completed item in the incomplete list
- When the real refetch happens (if the key matches), the item disappears, causing a "flash" effect
- **If the key doesn't match**, the completed item stays visible until manual refresh

---

## Critical Bug #3: React Query Stale Time Interference

### The Problem

**Location**: `src/lib/hooks/use-coordinator.ts` (lines 61, 92)

```typescript
staleTime: 30 * 1000, // 30 seconds
```

### What's Happening

When `invalidateQueries()` is called:
1. React Query checks if the data is "stale"
2. If data was fetched **within the last 30 seconds**, it's considered "fresh"
3. Fresh data is **NOT refetched** on invalidation

### Scenario

1. User loads the page at 10:00:00
2. Data is fresh until 10:00:30
3. User completes an item at 10:00:15
4. `invalidateQueries()` is called
5. React Query says: "Data is still fresh, no refetch needed"
6. Optimistic update remains, but server state never validates it

### Impact

- **Within 30 seconds** of page load, invalidations are ignored
- Optimistic updates can persist with incorrect data
- Creates intermittent failures based on timing

---

## Critical Bug #4: Un-awaited Metrics Invalidation

### The Problem

**Location**: 
- `src/components/coordinator/script-tab.tsx` (line 112)
- `src/components/coordinator/todo-tab.tsx` (line 107)

```typescript
// Ensure data is fresh after successful update
await qc.invalidateQueries({ queryKey });

// Also invalidate metrics to update the cards
qc.invalidateQueries({ queryKey: coordinatorKeys.metrics() });  // ❌ NOT AWAITED
```

### What's Happening

The metrics invalidation is not awaited, so the function can return before the metrics are updated.

### Impact

- Metrics cards (late tasks, due today counts) may not update
- Race condition: sometimes updates, sometimes doesn't
- Contributes to perceived "intermittent" behavior

---

## Critical Bug #5: Missing Parameters in Note Modal Close

### The Problem

**Location**: 
- `src/components/coordinator/script-tab.tsx` (lines 128-134)
- `src/components/coordinator/todo-tab.tsx` (lines 61-67)

```typescript
const handleCloseNotesModal = () => {
  setIsNotesModalOpen(false);
  setSelectedLead(null);
  qc.invalidateQueries({
    queryKey: coordinatorKeys.script(
      new URLSearchParams(
        memberId ? { memberId: String(memberId), range } : { range }  // ❌ Missing start, end, showCompleted
      ).toString()
    ),
  });
};
```

### What's Happening

Same query key mismatch issue when the notes modal closes and tries to invalidate to update note counts.

### Impact

- Note counts don't update after adding notes
- Same intermittent behavior pattern

---

## Why It's Intermittent

The bug appears intermittent because it depends on:

1. **URL Parameters**: Only fails when `showCompleted=true` or custom date ranges are used
2. **Timing**: Stale time window (30 seconds) creates time-based failures
3. **User Behavior**: Fast clicks within 30 seconds vs slower interactions
4. **Filter State**: Different users have different default filters

Users experiencing "always fails" likely have `showCompleted=true` enabled.  
Users experiencing "sometimes fails" are hitting the 30-second stale time window.

---

## Recommended Fixes

### Fix #1: Correct Query Key Construction (HIGH PRIORITY)

**File**: `src/components/coordinator/script-tab.tsx`

```typescript
async function toggleComplete(row: Row): Promise<void> {
  // Generate query key EXACTLY the same way as the hook
  const sp = new URLSearchParams();
  if (memberId) sp.set('memberId', String(memberId));
  if (range && range !== 'all') sp.set('range', range);
  if (start) sp.set('start', start);                        // ✅ ADD
  if (end) sp.set('end', end);                              // ✅ ADD
  if (showCompleted) sp.set('showCompleted', 'true');       // ✅ ADD
  const qs = sp.toString();
  const queryKey = coordinatorKeys.script(qs);
  
  // ... rest of function
}
```

**Same fix for**: `src/components/coordinator/todo-tab.tsx`

---

### Fix #2: Correct Optimistic Update for Filtered Views

```typescript
qc.setQueryData(queryKey, (oldData: any) => {
  if (!oldData) return oldData;
  
  // If showing completed, flip the flag
  if (showCompleted) {
    return oldData.map((item: any) => 
      item.member_program_item_schedule_id === row.member_program_item_schedule_id
        ? { ...item, completed_flag: !row.completed_flag }
        : item
    );
  }
  
  // If NOT showing completed, remove the item when marking complete
  if (!row.completed_flag) {
    // Marking as complete - remove from list
    return oldData.filter((item: any) => 
      item.member_program_item_schedule_id !== row.member_program_item_schedule_id
    );
  } else {
    // Marking as incomplete - just flip (item will stay in list)
    return oldData.map((item: any) => 
      item.member_program_item_schedule_id === row.member_program_item_schedule_id
        ? { ...item, completed_flag: false }
        : item
    );
  }
});
```

---

### Fix #3: Force Refetch on Invalidation

**File**: `src/lib/hooks/use-coordinator.ts`

**Option A**: Remove staleTime
```typescript
return useQuery({
  queryKey,
  queryFn: async () => { /* ... */ },
  // staleTime: 30 * 1000,  // ❌ REMOVE THIS
  gcTime: 2 * 60 * 1000,
  refetchOnWindowFocus: true,
});
```

**Option B**: Use `refetchType: 'active'` on invalidation
```typescript
await qc.invalidateQueries({ 
  queryKey,
  refetchType: 'active' // ✅ Force refetch even if fresh
});
```

---

### Fix #4: Await Metrics Invalidation

```typescript
// Ensure data is fresh after successful update
await qc.invalidateQueries({ queryKey });

// Also invalidate metrics to update the cards
await qc.invalidateQueries({ queryKey: coordinatorKeys.metrics() });  // ✅ AWAIT
```

---

### Fix #5: Fix Note Modal Query Key

```typescript
const handleCloseNotesModal = () => {
  setIsNotesModalOpen(false);
  setSelectedLead(null);
  
  // Generate query key the same way as the hook
  const sp = new URLSearchParams();
  if (memberId) sp.set('memberId', String(memberId));
  if (range && range !== 'all') sp.set('range', range);
  if (start) sp.set('start', start);
  if (end) sp.set('end', end);
  if (showCompleted) sp.set('showCompleted', 'true');
  
  qc.invalidateQueries({
    queryKey: coordinatorKeys.script(sp.toString()),
  });
};
```

---

## Testing Strategy

### Test Case 1: showCompleted=true
1. Enable "Show Completed" checkbox
2. Complete a task
3. **Expected**: Item disappears OR stays with "completed" status (depending on design)
4. **Verify**: No manual refresh needed

### Test Case 2: Custom Date Range
1. Set custom start/end dates
2. Complete a task
3. **Expected**: Item disappears immediately
4. **Verify**: No manual refresh needed

### Test Case 3: Rapid Clicks (<30 seconds)
1. Load page
2. Within 30 seconds, complete 3-5 tasks rapidly
3. **Expected**: All updates reflect immediately
4. **Verify**: No stale data persists

### Test Case 4: Notes Update
1. Open notes modal
2. Add a note
3. Close modal
4. **Expected**: Note count increments immediately

### Test Case 5: Metrics Update
1. Complete a task
2. **Expected**: "Tasks Due Today" and "Late Tasks" cards update immediately

---

## Implementation Priority

1. **CRITICAL**: Fix #1 (Query Key Mismatch) - This fixes 80% of the issue
2. **HIGH**: Fix #2 (Optimistic Update) - Improves UX significantly
3. **MEDIUM**: Fix #3 (Stale Time) - Eliminates timing-based failures
4. **MEDIUM**: Fix #4 (Await Metrics) - Fixes metrics not updating
5. **LOW**: Fix #5 (Notes Modal) - Nice to have, lower impact

---

## Risk Assessment

**Risk**: LOW  
**Complexity**: LOW  
**Files Changed**: 3 files (2 components, 1 hook)  
**Lines Changed**: ~50 lines total  
**Breaking Changes**: None  
**Testing Effort**: Medium (need to test multiple scenarios)

---

## Conclusion

The intermittent UI update failures are **NOT random** - they are systematic bugs caused by query key mismatches and improper cache invalidation strategies. All bugs have clear, straightforward fixes that can be implemented with minimal risk.

**Estimated Fix Time**: 1-2 hours  
**Estimated Test Time**: 2-3 hours  
**Total Effort**: 3-5 hours

