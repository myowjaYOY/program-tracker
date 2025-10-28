# Grid State Persistence Analysis

## 🔍 Issue Summary

**Observed Behavior:**
- ✅ Column resizing **PERSISTS** when switching between tabs (Script ↔ To Do) on the Coordinator page
- ❌ Column resizing **DOES NOT PERSIST** when navigating to a different page (Dashboard) and back

## 🏗️ Current Implementation

### BaseDataTable State Persistence (src/components/tables/base-data-table.tsx)

**Key Components:**
1. **Storage Key:** `${persistStateKey}_${user.id}` (user-specific)
2. **State Saved:** columns, sorting, filter, pagination (pageSize only), density, pinnedColumns
3. **Save Trigger:** Debounced (500ms) after state changes
4. **Restore Trigger:** useEffect with dependencies: `[persistStateKey, user?.id, apiRef, data.length]`

**Save Logic (lines 295-329):**
```typescript
const handleStateChange = useCallback(() => {
  if (!persistStateKey || !apiRef.current || !user?.id) return;
  
  // Debounce: wait 500ms after last change
  saveTimeoutRef.current = setTimeout(() => {
    const currentState = apiRef.current.exportState();
    const stateToPersist = {
      columns: currentState.columns,
      sorting: currentState.sorting,
      filter: currentState.filter,
      pagination: { paginationModel: { pageSize: ... } },
      density: currentState.density,
      pinnedColumns: currentState.pinnedColumns,
    };
    localStorage.setItem(storageKey, JSON.stringify(stateToPersist));
  }, 500);
}, [persistStateKey, user?.id, apiRef]);
```

**Restore Logic (lines 332-361):**
```typescript
useEffect(() => {
  if (!persistStateKey || !user?.id || !apiRef.current) return;
  
  const dataChanged = !hasRestoredStateRef.current || lastDataLengthRef.current !== data.length;
  if (!dataChanged) return;
  
  const savedState = localStorage.getItem(storageKey);
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    setTimeout(() => {
      if (apiRef.current) {
        apiRef.current.restoreState(parsedState);
      }
    }, 0);
  }
  hasRestoredStateRef.current = true;
  lastDataLengthRef.current = data.length;
}, [persistStateKey, user?.id, apiRef, data.length]);
```

### React Query Configuration (src/lib/hooks/use-coordinator.ts)

**Script & To Do Tabs:**
- `staleTime: 30 * 1000` (30 seconds)
- `gcTime: 2 * 60 * 1000` (2 minutes - garbage collection time)
- `refetchOnWindowFocus: true`

## 🐛 Root Cause Analysis

### Scenario 1: Switching Tabs (Script ↔ To Do) - ✅ WORKS

**Timeline:**
1. User on Script tab, resizes column
2. `handleStateChange` fires → saves to localStorage after 500ms
3. User switches to To Do tab
4. React unmounts `<CoordinatorScriptTab />` component
5. `hasRestoredStateRef` and `saveTimeoutRef` are destroyed
6. BUT: localStorage persists (browser storage)
7. React Query cache persists (2-minute gcTime)
8. User switches back to Script tab
9. React mounts fresh `<CoordinatorScriptTab />` component
10. `hasRestoredStateRef.current = false` (new instance)
11. `useCoordinatorScript` hook fetches data (from cache or refetch)
12. Data arrives → `data.length` changes or first mount
13. Restoration effect fires → reads from localStorage → restores state
14. ✅ **Column widths restored**

**Why it works:** localStorage persists, React Query cache persists, component lifecycle is clean.

### Scenario 2: Navigate Away and Back - ❌ FAILS

**Timeline:**
1. User on Coordinator page (Script tab), resizes column
2. `handleStateChange` fires → saves to localStorage after 500ms
3. User navigates to Dashboard page
4. Entire Coordinator page unmounts (including all tabs)
5. `saveTimeoutRef` is destroyed
   - **⚠️ POTENTIAL ISSUE #1:** If user navigates within the 500ms debounce window, the save never completes
6. User navigates back to Coordinator page
7. Page remounts, default `tab = 0` (Script tab)
8. `useCoordinatorScript` hook fetches data
9. **⚠️ CRITICAL TIMING ISSUE:** 
   - `apiRef` is created by `useGridApiRef()`
   - `apiRef` object reference is stable, but `apiRef.current` is `null` initially
   - Restoration effect runs: `if (!apiRef.current) return;` → **early exit**
   - DataGrid initializes → `apiRef.current` becomes available
   - BUT: The effect dependencies `[persistStateKey, user?.id, apiRef, data.length]` don't change!
   - `apiRef` object reference hasn't changed (same object)
   - `data.length` might not change if cached data is used
   - **Effect doesn't re-run → state never restored**

## 🔍 The Core Problem

**Issue #1: `apiRef` Dependency Problem**

The restoration effect depends on `apiRef` (the object), but checks `apiRef.current` (the value):

```typescript
useEffect(() => {
  if (!apiRef.current) return; // Checks .current
  // ... restoration logic
}, [persistStateKey, user?.id, apiRef, data.length]); // Depends on apiRef object
```

- `apiRef` object reference is created once and never changes
- `apiRef.current` changes when the grid initializes, but this doesn't trigger the effect
- If data comes from React Query cache with same length, no re-trigger

**Issue #2: Debounce Race Condition**

If user navigates away within 500ms of resizing a column:
- `setTimeout` is queued but not executed
- Component unmounts → timeout is cleared
- State never saves to localStorage
- **Data loss**

**Issue #3: Data Length Dependency**

The effect only runs when `data.length` changes:
```typescript
const dataChanged = !hasRestoredStateRef.current || lastDataLengthRef.current !== data.length;
if (!dataChanged) return;
```

If React Query serves cached data with the same length:
- Effect runs once with `apiRef.current === null` → early exit
- Data loads with same length → effect doesn't re-run
- State never restored

## ✅ Recommended Solutions

### **Solution A: Add MUI Grid Event Listener (RECOMMENDED)**

Instead of relying on `apiRef` in dependencies, use MUI's grid lifecycle events:

```typescript
// Add after apiRef creation
useEffect(() => {
  if (!persistStateKey || !user?.id || !apiRef.current) return;
  
  const handleGridReady = () => {
    const storageKey = `${persistStateKey}_${user.id}`;
    const savedState = localStorage.getItem(storageKey);
    if (savedState && !hasRestoredStateRef.current) {
      const parsedState = JSON.parse(savedState);
      apiRef.current.restoreState(parsedState);
      hasRestoredStateRef.current = true;
    }
  };
  
  // Listen for grid initialization
  if (apiRef.current) {
    handleGridReady();
  }
  
  return apiRef.current?.subscribeEvent?.('stateChange', handleStateChange);
}, [persistStateKey, user?.id, apiRef.current]); // Depend on apiRef.current
```

**Pros:**
- Directly listens for grid readiness
- No race conditions
- Clean separation of concerns

**Cons:**
- Depends on `apiRef.current` which React discourages

### **Solution B: Use Separate Effect with apiRef.current Check**

```typescript
// Restoration effect - runs when apiRef.current becomes available
useEffect(() => {
  if (!persistStateKey || !user?.id || !apiRef.current || hasRestoredStateRef.current) return;
  
  const storageKey = `${persistStateKey}_${user.id}`;
  const savedState = localStorage.getItem(storageKey);
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    // Delay to ensure grid is fully initialized
    const timer = setTimeout(() => {
      if (apiRef.current) {
        apiRef.current.restoreState(parsedState);
        hasRestoredStateRef.current = true;
      }
    }, 100); // Small delay for grid initialization
    
    return () => clearTimeout(timer);
  }
}, [persistStateKey, user?.id, apiRef.current]); // Depend on apiRef.current
```

**Pros:**
- Simple, targeted fix
- Minimal code change

**Cons:**
- React warning about depending on `.current`
- Magic timeout number

### **Solution C: Force Re-render When Grid Ready**

```typescript
const [gridReady, setGridReady] = useState(false);

useEffect(() => {
  if (apiRef.current && !gridReady) {
    setGridReady(true);
  }
}, [apiRef.current, gridReady]);

useEffect(() => {
  if (!persistStateKey || !user?.id || !gridReady || !apiRef.current) return;
  // ... restoration logic
}, [persistStateKey, user?.id, gridReady, data.length]);
```

**Pros:**
- React-friendly (no .current in deps)
- Explicit grid readiness state

**Cons:**
- Extra state variable
- Extra re-render

### **Solution D: Reduce Debounce + Force Save on Unmount**

Fix the debounce race condition:

```typescript
// Cleanup: Force immediate save on unmount
useEffect(() => {
  return () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      // Force immediate save
      if (apiRef.current && persistStateKey && user?.id) {
        const storageKey = `${persistStateKey}_${user.id}`;
        const currentState = apiRef.current.exportState();
        const stateToPersist = { /* ... */ };
        localStorage.setItem(storageKey, JSON.stringify(stateToPersist));
      }
    }
  };
}, [persistStateKey, user?.id, apiRef]);
```

**Pros:**
- Prevents data loss on navigation
- Can combine with other solutions

**Cons:**
- Doesn't fix the restoration issue
- Must combine with Solution A, B, or C

## 🎯 Recommended Approach

**Combine Solution C + Solution D:**

1. Add `gridReady` state to track when grid is initialized
2. Update restoration effect to depend on `gridReady`
3. Add force-save on unmount to prevent debounce data loss
4. This provides:
   - React-friendly dependencies
   - Reliable restoration timing
   - No data loss on navigation

## 📊 Risk Assessment

| Solution | Risk Level | Code Changes | Reliability |
|----------|-----------|--------------|-------------|
| Solution A | Medium | Medium | High |
| Solution B | Low | Small | Medium |
| Solution C | Low | Medium | High |
| Solution D | Low | Small | Medium |
| C + D | Low | Medium | Very High |

## 🧪 Testing Checklist

After implementing fix:

- [ ] Resize column on Script tab, switch to To Do tab, come back → widths persist
- [ ] Resize column on Script tab, navigate to Dashboard, come back → widths persist
- [ ] Resize column, wait 500ms, navigate away → widths persist
- [ ] Resize column, immediately navigate away (< 500ms) → widths persist
- [ ] Filter, sort, change page size, navigate away/back → all settings persist
- [ ] Test with different users → each user has their own settings
- [ ] Clear localStorage, reload → no errors, defaults applied
- [ ] Test on Script tab, To Do tab, and other grids with `persistStateKey`

