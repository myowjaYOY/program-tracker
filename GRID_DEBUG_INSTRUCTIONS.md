# 🔍 Grid Persistence Debug Instructions

## What I Just Added

I've added comprehensive console logging to track exactly what's happening with grid state persistence.

## How to Debug

### **Step 1: Open Production Site**
1. Go to your production site
2. Open Chrome DevTools (F12)
3. Go to Console tab
4. **Clear all logs** (trash icon)

### **Step 2: Test Grid Persistence**

1. Navigate to **Coordinator → Script tab**
2. Look for logs that say `[GRID DEBUG]`
3. **Take screenshot of console**

You should see logs like:
```
[GRID DEBUG] Loading state: { storageKey: "coordinatorScriptGrid_123", hasSavedState: true/false, ... }
[GRID DEBUG] Setting initialState: { hasInitialGridState: true/false, hasColumns: true/false, ... }
```

### **Step 3: Make a Change**

1. **Resize a column** (make it noticeably wider/narrower)
2. Navigate to **Dashboard**
3. Look for log that says `[GRID DEBUG] Saving state on unmount`
4. **Take screenshot of this log**

### **Step 4: Come Back**

1. Navigate back to **Coordinator → Script tab**
2. Look for `[GRID DEBUG] Loading state` again
3. **Take screenshot**
4. **Check if column width actually changed**

---

## What We're Looking For

### **Scenario A: State is NOT being saved**
If you see:
```
[GRID DEBUG] Cannot save on unmount: { hasPersistKey: false, hasUserId: false, hasApiRef: false }
```
**Problem:** One of the required values is missing when trying to save.

### **Scenario B: State is saved but NOT loaded**
If you see:
```
[GRID DEBUG] Saving state on unmount: { storageKey: "...", hasColumns: true, ... }
[GRID DEBUG] Loading state: { hasSavedState: false }
```
**Problem:** State is being saved, but localStorage is being cleared or user ID is changing.

### **Scenario C: State is loaded but NOT applied**
If you see:
```
[GRID DEBUG] Loading state: { hasSavedState: true }
[GRID DEBUG] Parsed state: { columns: true, sorting: true, ... }
[GRID DEBUG] Setting initialState: { hasInitialGridState: true, hasColumns: true }
```
But the grid still shows default column widths.

**Problem:** DataGrid is ignoring the initialState prop (MUI bug or our usage is wrong).

### **Scenario D: useMemo not running**
If you DON'T see `[GRID DEBUG] Loading state` at all when page loads.

**Problem:** The useMemo isn't running, which means user?.id might not be available yet.

---

## Quick Test in Console

While on the Coordinator Script tab, run this in console:

```javascript
// Check if localStorage has saved state
Object.keys(localStorage).filter(k => k.includes('Grid'))

// Check specific grid state
localStorage.getItem('coordinatorScriptGrid_YOUR_USER_ID')

// See your user ID
console.log('User ID:', document.cookie)
```

---

## What to Send Me

Please send me:
1. **Screenshots of ALL `[GRID DEBUG]` logs** (from page load to navigation back)
2. **What actually happened** (did column width persist? yes/no)
3. **localStorage check** (run the console commands above, send results)

This will tell me EXACTLY where it's failing.

---

## If You Want to Test Right Now

1. Deploy this version with logging
2. Test immediately
3. Send me the console logs
4. I'll identify the exact failure point and fix it

No more guessing. We'll see exactly what's broken.

