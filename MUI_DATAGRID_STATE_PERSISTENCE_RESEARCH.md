# MUI DataGrid State Persistence - Research & Best Practices

## 📚 **Research Summary**

I've researched the official MUI DataGrid documentation and community best practices for state persistence.

---

## ✅ **Official MUI Pattern (From Documentation)**

### **What MUI Recommends:**

**Two Simple Approaches:**

### **Approach 1: Using `initialState` Prop (SIMPLEST)**

```javascript
import { DataGrid } from '@mui/x-data-grid';

function MyDataGrid() {
  // Load saved state from localStorage
  const savedState = JSON.parse(localStorage.getItem('gridState')) || {};

  // Save state when it changes
  const handleStateChange = (state) => {
    localStorage.setItem('gridState', JSON.stringify(state));
  };

  return (
    <DataGrid
      initialState={savedState}
      onStateChange={handleStateChange}
      // ...other props
    />
  );
}
```

**Pros:**
- ✅ Simplest approach - no `apiRef` needed
- ✅ No manual timing management
- ✅ Declarative (React-friendly)
- ✅ Grid handles restoration internally

**Cons:**
- ❌ `onStateChange` fires on EVERY state change (no debounce)
- ❌ Might be performance-heavy on large grids with frequent changes

---

### **Approach 2: Using `apiRef` with `exportState` / `restoreState` (OFFICIAL)**

```javascript
import { DataGrid, useGridApiRef } from '@mui/x-data-grid';
import { useEffect } from 'react';

function MyDataGrid() {
  const apiRef = useGridApiRef();

  // Restore state on mount
  useEffect(() => {
    const savedState = localStorage.getItem('gridState');
    if (savedState) {
      apiRef.current.restoreState(JSON.parse(savedState));
    }
  }, [apiRef]);

  // Save state before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const state = apiRef.current.exportState();
      localStorage.setItem('gridState', JSON.stringify(state));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [apiRef]);

  return (
    <DataGrid
      apiRef={apiRef}
      // ...other props
    />
  );
}
```

**Pros:**
- ✅ Official recommended approach
- ✅ Only saves on page unload (efficient)
- ✅ Full control via `apiRef`
- ✅ Works for all state aspects (columns, sorting, filtering, pagination)

**Cons:**
- ❌ Requires `apiRef` setup
- ❌ Depends on `beforeunload` (won't save on React navigation in SPA)

---

## 🔍 **Key Findings from Research**

### **1. MUI Official Documentation Says:**

- **Persistence Scope:** Column width, order, visibility, sorting, filtering, pagination
- **Methods:** `exportState()` and `restoreState()` via `apiRef`
- **Storage:** `localStorage` for client-side, database for cross-device
- **Timing:** Save on `beforeunload`, restore on mount

### **2. What MUI Does NOT Recommend:**

- ❌ **Debouncing state saves** - Not mentioned in docs
- ❌ **Tracking data changes** - Not mentioned in docs
- ❌ **Re-restoring state** - Restore once on mount only
- ❌ **Complex lifecycle management** - Keep it simple
- ❌ **Tracking `gridReady` state** - Not in official examples

### **3. Common Pitfalls (from Community):**

⚠️ **Problem:** `apiRef.current` is `null` initially
- **Solution:** Use `useEffect` with `[apiRef]` dependency, check for `apiRef.current` before calling

⚠️ **Problem:** State restores but then resets
- **Solution:** Don't restore multiple times - restore ONCE on mount only

⚠️ **Problem:** Controlled models (filter, sort) not working
- **Solution:** If using controlled props (`filterModel`, `sortModel`), ensure callbacks update those props

⚠️ **Problem:** State not saving in SPA on navigation
- **Solution:** Use component unmount cleanup instead of (or in addition to) `beforeunload`

---

## 🎯 **Recommended Implementation for Your App**

### **Best Approach: Hybrid Pattern**

Combine official pattern with SPA-friendly unmount save:

```javascript
import { DataGrid, useGridApiRef } from '@mui/x-data-grid-pro';
import { useEffect } from 'react';

function BaseDataTable({ persistStateKey, ...props }) {
  const apiRef = useGridApiRef();
  const { user } = useAuth();

  // Create per-user storage key
  const storageKey = persistStateKey && user?.id 
    ? `${persistStateKey}_${user.id}` 
    : null;

  // Restore state ONCE on mount
  useEffect(() => {
    if (!storageKey || !apiRef.current) return;

    const savedState = localStorage.getItem(storageKey);
    if (savedState) {
      try {
        apiRef.current.restoreState(JSON.parse(savedState));
      } catch (error) {
        console.error('Failed to restore grid state:', error);
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]); // Only run once when storageKey is available

  // Save state on unmount (SPA navigation)
  useEffect(() => {
    return () => {
      if (storageKey && apiRef.current) {
        try {
          const state = apiRef.current.exportState();
          localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
          console.error('Failed to save grid state:', error);
        }
      }
    };
  }, [storageKey]);

  // Save state on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (storageKey && apiRef.current) {
        try {
          const state = apiRef.current.exportState();
          localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
          console.error('Failed to save grid state:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [storageKey]);

  return (
    <DataGridPro
      apiRef={apiRef}
      {...props}
    />
  );
}
```

---

## ✅ **Why This is Simple and Correct**

### **What This Does:**

1. **Restore ONCE** on mount (when `storageKey` is available)
2. **Save on unmount** (React navigation in SPA)
3. **Save on beforeunload** (browser close/refresh)
4. **Per-user, per-grid** via `storageKey`
5. **Error handling** to prevent crashes on corrupted state

### **What This Does NOT Do:**

- ❌ No debouncing
- ❌ No tracking data changes
- ❌ No complex `gridReady` state
- ❌ No dependency on `data.length`
- ❌ No multiple restoration attempts
- ❌ No `onStateChange` callback (only save on unmount)

### **Why This Works:**

- **Restoration:** Happens once when grid is initialized (no re-restoration)
- **Saving:** Happens on unmount and page close (efficient, no performance cost)
- **React Query refetch:** Doesn't trigger restoration because no `data.length` dependency
- **Simple:** Follows official MUI pattern with SPA enhancement

---

## 📊 **Comparison: Our Current Code vs. Recommended**

| Aspect | Current Implementation | Recommended Pattern |
|--------|----------------------|---------------------|
| **Restore timing** | On mount + data changes | Once on mount only |
| **Restore trigger** | `gridReady` state + data.length | `storageKey` availability |
| **Save timing** | Debounced (500ms) + unmount | Only on unmount + beforeunload |
| **Save trigger** | `onStateChange` callback | Cleanup effects |
| **Complexity** | High (~100 lines) | Low (~40 lines) |
| **State tracking** | `gridReady`, `hasRestored`, `lastDataLength` | None (let MUI handle it) |
| **Dependencies** | 4+ state variables | 1 variable (`storageKey`) |
| **Re-restoration** | Can happen on data refetch | Never happens |
| **Performance** | Debounce overhead | Minimal (save only on exit) |

---

## 🚨 **What Was Wrong with Our Implementation**

### **Problem 1: Over-engineering**
- We added `gridReady` state tracking
- We tracked `lastDataLength`
- We used `hasRestoredStateRef`
- **MUI doesn't need any of this**

### **Problem 2: Multiple Restoration Attempts**
- Effect had `data.length` as dependency
- React Query refetch changed `data.length`
- Effect ran again, causing re-restoration
- **MUI says: restore once on mount only**

### **Problem 3: Debounced Saves**
- Used `onStateChange` callback with 500ms debounce
- Added complexity with `setTimeout` and cleanup
- **MUI says: save on unmount/beforeunload only**

### **Problem 4: Fighting React Lifecycle**
- Tried to detect when `apiRef.current` is ready
- Added extra effects and state to manage timing
- **MUI pattern: just use `useEffect([apiRef])` and check for `apiRef.current`**

---

## ✅ **Recommended Action Plan**

### **Step 1: Simplify Implementation**

Replace current complex implementation with the recommended hybrid pattern above.

### **Step 2: Remove Unnecessary Code**

- ❌ Remove `gridReady` state
- ❌ Remove `lastDataLengthRef`
- ❌ Remove debounce timer (`saveTimeoutRef`)
- ❌ Remove `onStateChange` callback prop
- ❌ Remove `data.length` from dependencies
- ✅ Keep only: `storageKey`, `apiRef`, and two simple effects

### **Step 3: Test**

- Resize column → navigate away → come back → **should persist**
- Change sort → navigate away → come back → **should persist**
- Apply filter → navigate away → come back → **should persist**
- Close browser → reopen → **should persist**

---

## 📝 **Summary**

**The Official MUI Pattern is SIMPLE:**
1. Restore state once on mount using `apiRef.current.restoreState()`
2. Save state on unmount and `beforeunload` using `apiRef.current.exportState()`
3. Don't overthink it - let MUI handle the complexity internally

**We were over-engineering it by:**
- Adding state tracking (`gridReady`, `lastDataLength`)
- Debouncing saves
- Trying to restore multiple times
- Fighting React lifecycle

**The fix:**
- Follow the official pattern exactly
- Keep it simple
- Trust MUI to handle the details

---

**Ready to implement the recommended simple pattern?**

