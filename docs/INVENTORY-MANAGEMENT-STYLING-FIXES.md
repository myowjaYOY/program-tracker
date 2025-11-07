# Inventory Management - Physical Count Styling Fixes

## Issues Identified

### 1. **DataGrid Styling** (`src/components/inventory/physical-count-tab.tsx`)

**Current State:**
- Lines 302-326: Basic DataGrid with minimal custom styling
- Missing consistent styling patterns found in BaseDataTable

**What Needs Fixing:**
- ✅ Grid already has proper cell focus removal and row hover
- ❌ Missing consistent border styling
- ❌ Could use better spacing and visual hierarchy

**Recommended Changes:**
```typescript
// Match BaseDataTable styling patterns
sx={{
  border: 0,  // Already present ✅
  '& .MuiDataGrid-cell:focus': {
    outline: 'none',  // Already present ✅
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'action.hover',  // Already present ✅
  },
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: 'grey.50',
    borderBottom: 2,
    borderColor: 'divider',
  },
}}
```

---

### 2. **Custom Count Option Disabled** (`src/components/inventory/start-count-modal.tsx`)

**Current State:**
- Line 142: `disabled` prop explicitly set on "Custom Count" radio option
- Line 138: Shows "(coming soon)" in description

**Why It's Disabled:**
The Custom Count feature requires:
1. **UI for item selection** (checkbox list or multi-select)
2. **Validation logic** to ensure at least one item is selected
3. **Backend support** for `selected_item_ids` array
4. **API endpoint** to handle custom counts

**What's Already in Place:**
✅ Schema accepts `selected_item_ids` (line 57-58)
✅ Backend API likely supports it
✅ Form structure is ready

**What Needs to Be Implemented:**
❌ Item selection UI (multiselect or checkbox list)
❌ Conditional rendering based on count_type
❌ Fetch available inventory items
❌ Validation: ensure at least 1 item selected for custom

**Recommendation:**
- Can enable the option NOW
- Add a TODO note that item selection UI is not yet implemented
- Show an Alert when "custom" is selected explaining the feature is in progress
- OR implement the full item selection UI now

---

### 3. **Button Styling** (`src/components/inventory/start-count-modal.tsx`)

**Current State:**
- Lines 201-210: Buttons likely have default MUI rounded corners
- Should match application standard: `borderRadius: 0` (square corners)

**Fix Required:**
```typescript
// Cancel button (line 201)
<Button 
  onClick={handleClose} 
  disabled={startMutation.isPending}
  sx={{ borderRadius: 0 }}  // ADD THIS
>
  Cancel
</Button>

// Submit button (line 204)
<Button
  type="submit"
  variant="contained"
  disabled={startMutation.isPending}
  sx={{ borderRadius: 0 }}  // ADD THIS
>
  {startMutation.isPending ? 'Starting...' : 'Start Count Session'}
</Button>
```

---

### 4. **Cancel Button Should Be X Icon** (`src/components/inventory/start-count-modal.tsx`)

**Current State:**
- Line 201: Cancel button in DialogActions
- Should follow app pattern: X icon in top-right of DialogTitle

**Reference Pattern** (from `src/components/programs/member-program-rasha-tab.tsx:446-458`):
```typescript
<DialogTitle>
  Start New Physical Count
  <IconButton
    onClick={handleClose}
    sx={{
      position: 'absolute',
      right: 8,
      top: 8,
    }}
  >
    <CloseIcon />
  </IconButton>
</DialogTitle>
```

**Required Changes:**
1. Add `Close as CloseIcon` import from `@mui/icons-material`
2. Add `IconButton` import from `@mui/material`
3. Move close button from DialogActions to DialogTitle
4. Remove Cancel button from DialogActions
5. Keep only Submit button in DialogActions

---

### 5. **Grid Styling on Main Page** (`src/app/dashboard/inventory-management/page.tsx`)

**Current State:**
- Lines 80-464: Using Grid v2 `size` prop ✅ CORRECT
- Cards are already well-styled with:
  - Colored top borders ✅
  - Hover effects ✅
  - Proper spacing ✅
  - Consistent sizing ✅

**Status:** ✅ **ALREADY MATCHES PATTERNS** - No changes needed

---

## Implementation Priority

### High Priority (Do Now):
1. ✅ Fix button styling (add `borderRadius: 0`)
2. ✅ Replace Cancel button with X icon
3. ✅ Improve DataGrid header styling

### Medium Priority (Explain to User):
4. ⚠️ Custom Count - explain what's needed to implement

### Low Priority:
5. ✅ Main page Grid - already correct

---

## Custom Count Implementation Options

### Option A: Enable with Placeholder Message (Quick Fix)
```typescript
<FormControlLabel
  value="custom"
  control={<Radio />}
  label={...}
  // Remove disabled prop
/>

// Add conditional alert in form
{watch('count_type') === 'custom' && (
  <Alert severity="warning">
    Custom count item selection UI is not yet implemented. 
    This will count all items for now.
  </Alert>
)}
```

### Option B: Fully Implement Item Selection (Complete Solution)
Requires:
1. Fetch inventory items: `const { data: items } = useInventoryItems();`
2. Add item selection UI:
```typescript
{watch('count_type') === 'custom' && (
  <Controller
    name="selected_item_ids"
    control={control}
    render={({ field }) => (
      <FormControl fullWidth>
        <FormLabel>Select Items to Count</FormLabel>
        <Select
          multiple
          value={field.value || []}
          onChange={field.onChange}
        >
          {items?.map(item => (
            <MenuItem key={item.id} value={item.id}>
              {item.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    )}
  />
)}
```
3. Add validation for selected_item_ids when count_type === 'custom'

---

## Files to Modify

1. ✅ `src/components/inventory/start-count-modal.tsx`
   - Add imports (CloseIcon, IconButton)
   - Move close button to DialogTitle
   - Remove Cancel from DialogActions
   - Add borderRadius: 0 to submit button
   - Optional: Enable custom count with warning

2. ✅ `src/components/inventory/physical-count-tab.tsx`
   - Enhance DataGrid styling (headers)

3. ❌ `src/app/dashboard/inventory-management/page.tsx`
   - NO CHANGES NEEDED - Already correct

---

## Recommendation

**Start with the styling fixes** (buttons, X icon, grid headers), then discuss with user whether to:
- **Option A:** Enable custom count with a "coming soon" message
- **Option B:** Fully implement custom count item selection now

The groundwork is already in place for Option B, just needs the UI component.

