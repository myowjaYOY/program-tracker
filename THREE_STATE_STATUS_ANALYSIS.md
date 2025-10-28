# Three-State Status for Schedule Items - Analysis & Recommendation

## Current State

**Database:**
- `member_program_item_schedule.completed_flag`: `boolean NOT NULL DEFAULT false`
- `member_program_items_task_schedule.completed_flag`: `boolean NOT NULL DEFAULT false`

**Current Logic:**
- `true` = Completed
- `false` = Not Completed (no distinction between missed vs pending)

---

## Desired Three States

1. **Redeemed** - User explicitly marked as complete
2. **Not Redeemed** - Past the scheduled date, not completed (missed/expired)
3. **Unknown/Pending** - Future item or not yet addressed

---

## 🎯 RECOMMENDED SOLUTION

### **Option A: Computed Status (NO Database Change)**

**How it Works:**
Derive status from existing data:

```typescript
function getItemStatus(completed_flag: boolean, scheduled_date: Date): 'redeemed' | 'missed' | 'pending' {
  if (completed_flag === true) {
    return 'redeemed';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const schedDate = new Date(scheduled_date);
  schedDate.setHours(0, 0, 0, 0);
  
  if (schedDate < today) {
    return 'missed';  // Past due, not completed
  }
  
  return 'pending';  // Future or today, not yet completed
}
```

**Advantages:**
✅ No database migration required  
✅ No data inconsistency risk  
✅ Backward compatible  
✅ Status always accurate based on current date  
✅ Easy to implement  
✅ No breaking changes  

**Disadvantages:**
⚠️ Can't manually mark as "missed" before due date  
⚠️ Status changes automatically as dates pass  

---

### **Option B: Add Status Column (Database Change)**

**Migration:**
```sql
-- Add new status column
ALTER TABLE member_program_item_schedule 
ADD COLUMN status text CHECK (status IN ('pending', 'redeemed', 'missed', 'cancelled'));

ALTER TABLE member_program_items_task_schedule 
ADD COLUMN status text CHECK (status IN ('pending', 'redeemed', 'missed', 'cancelled'));

-- Set initial values based on completed_flag
UPDATE member_program_item_schedule 
SET status = CASE 
  WHEN completed_flag = true THEN 'redeemed'
  WHEN scheduled_date < CURRENT_DATE THEN 'missed'
  ELSE 'pending'
END;

UPDATE member_program_items_task_schedule 
SET status = CASE 
  WHEN completed_flag = true THEN 'redeemed'
  WHEN due_date < CURRENT_DATE THEN 'missed'
  ELSE 'pending'
END;
```

**Advantages:**
✅ Explicit status storage  
✅ Can manually set any status anytime  
✅ Historical record of status changes  
✅ More flexible (can add states like 'cancelled')  
✅ No date calculations needed  

**Disadvantages:**
❌ Requires database migration  
❌ Risk of data inconsistency (status vs completed_flag)  
❌ Need to update all API routes  
❌ Need to update all UI components  
❌ Breaking change  

---

## 🎨 UI Control Options

### **Option 1: Icon Cycle Button (RECOMMENDED)**

**Visual:**
```
[⭕ Pending] → Click → [✅ Redeemed] → Click → [❌ Missed] → Click → [⭕ Pending]
```

**Implementation:**
```tsx
function StatusCycleButton({ status, onStatusChange }) {
  const statusConfig = {
    pending: { icon: RadioButtonUncheckedIcon, color: 'default', label: 'Pending', next: 'redeemed' },
    redeemed: { icon: CheckCircleIcon, color: 'success', label: 'Redeemed', next: 'missed' },
    missed: { icon: CancelIcon, color: 'error', label: 'Missed', next: 'pending' },
  };
  
  const config = statusConfig[status];
  const IconComponent = config.icon;
  
  return (
    <Tooltip title={`Click to mark as ${statusConfig[config.next].label}`}>
      <IconButton
        size="small"
        color={config.color}
        onClick={() => onStatusChange(config.next)}
      >
        <IconComponent />
      </IconButton>
    </Tooltip>
  );
}
```

**Advantages:**
✅ Single click to change status  
✅ Visual, intuitive  
✅ Space-efficient  
✅ Mobile-friendly  

**Disadvantages:**
⚠️ Need to cycle through states (can't jump)  
⚠️ Might not be obvious it's a 3-state cycle  

---

### **Option 2: Dropdown/Select**

**Visual:**
```
[Dropdown ▼]
  • Pending
  • Redeemed
  • Missed
```

**Implementation:**
```tsx
function StatusSelect({ status, onStatusChange }) {
  return (
    <Select
      size="small"
      value={status}
      onChange={(e) => onStatusChange(e.target.value)}
    >
      <MenuItem value="pending">⭕ Pending</MenuItem>
      <MenuItem value="redeemed">✅ Redeemed</MenuItem>
      <MenuItem value="missed">❌ Missed</MenuItem>
    </Select>
  );
}
```

**Advantages:**
✅ All options visible  
✅ Can jump to any state  
✅ Very clear  

**Disadvantages:**
⚠️ Takes more space  
⚠️ Requires two clicks (open + select)  

---

### **Option 3: Chip Toggle (Click to Cycle)**

**Visual:**
```
[Pending] → Click → [Redeemed] → Click → [Missed]
(Gray chip)         (Green chip)         (Red chip)
```

**Implementation:**
```tsx
function StatusChip({ status, onStatusChange, readOnly = false }) {
  const statusConfig = {
    pending: { color: 'default', label: 'Pending', next: 'redeemed' },
    redeemed: { color: 'success', label: 'Redeemed', next: 'missed' },
    missed: { color: 'error', label: 'Missed', next: 'pending' },
  };
  
  const config = statusConfig[status];
  
  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
      onClick={() => !readOnly && onStatusChange(config.next)}
      sx={{ cursor: readOnly ? 'default' : 'pointer' }}
    />
  );
}
```

**Advantages:**
✅ Clean, modern look  
✅ Matches existing UI pattern  
✅ Single click  
✅ Color-coded  

**Disadvantages:**
⚠️ Cycles through states (like Option 1)  

---

### **Option 4: Context Menu (Right-Click)**

**Visual:**
```
[Status Chip] → Right-click → Menu appears
  • Mark as Pending
  • Mark as Redeemed
  • Mark as Missed
```

**Advantages:**
✅ Doesn't clutter UI  
✅ All options accessible  
✅ Professional feel  

**Disadvantages:**
⚠️ Not mobile-friendly  
⚠️ Not discoverable (users may not know to right-click)  

---

## 📊 Comparison Matrix

| Feature | Cycle Button | Dropdown | Chip Toggle | Context Menu |
|---------|-------------|----------|-------------|--------------|
| **Space Efficiency** | ✅ Excellent | ⚠️ Moderate | ✅ Excellent | ✅ Excellent |
| **Clarity** | ⚠️ Moderate | ✅ Excellent | ✅ Good | ⚠️ Poor |
| **Speed** | ✅ 1 click | ⚠️ 2 clicks | ✅ 1 click | ⚠️ 2+ actions |
| **Mobile Friendly** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Discoverable** | ✅ Good | ✅ Excellent | ✅ Good | ❌ Poor |
| **Matches Current UI** | ✅ Yes | ⚠️ Different | ✅ Yes | ❌ No |

---

## 🎯 FINAL RECOMMENDATION

### **Approach: Option A (Computed Status)**
### **UI Control: Option 3 (Chip Toggle with Enhancement)**

**Why This Combination:**
1. ✅ No breaking database changes
2. ✅ Matches existing Chip UI pattern (Completed column)
3. ✅ Intuitive - users already click chips
4. ✅ Space-efficient
5. ✅ Works on mobile

**Enhanced Implementation:**
```tsx
function StatusChip({ completed_flag, scheduled_date, onStatusChange, readOnly }) {
  // Compute current status
  const status = getItemStatus(completed_flag, scheduled_date);
  
  const handleClick = () => {
    if (readOnly) return;
    
    // When clicking, we only toggle completed_flag
    // Status will be derived automatically
    switch (status) {
      case 'pending':
        onStatusChange({ completed_flag: true }); // Mark as redeemed
        break;
      case 'redeemed':
        onStatusChange({ completed_flag: false }); // Mark as not completed
        // Will become 'missed' or 'pending' based on date
        break;
      case 'missed':
        onStatusChange({ completed_flag: true }); // Allow redemption of missed items
        break;
    }
  };
  
  return (
    <Tooltip title={getTooltipText(status)}>
      <Chip
        label={statusLabels[status]}
        color={statusColors[status]}
        size="small"
        onClick={handleClick}
        icon={statusIcons[status]}
        sx={{ cursor: readOnly ? 'default' : 'pointer' }}
      />
    </Tooltip>
  );
}
```

---

## 🚀 Implementation Plan

### **Phase 1: Update Types**
```typescript
// Add to types/common.ts
export type ScheduleItemStatus = 'pending' | 'redeemed' | 'missed';

export interface ScheduleItemWithStatus {
  completed_flag: boolean;
  scheduled_date: string;
  status: ScheduleItemStatus; // Computed property
}
```

### **Phase 2: Add Status Computation Utility**
```typescript
// lib/utils/schedule-status.ts
export function getScheduleItemStatus(
  completed_flag: boolean,
  scheduled_date: string | Date
): ScheduleItemStatus {
  if (completed_flag) return 'redeemed';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const schedDate = new Date(scheduled_date);
  schedDate.setHours(0, 0, 0, 0);
  
  return schedDate < today ? 'missed' : 'pending';
}
```

### **Phase 3: Update UI Components**
- ✅ `CoordinatorScriptTab` - Replace Chip
- ✅ `CoordinatorToDoTab` - Replace Chip
- ✅ `ProgramScriptTab` - Replace Chip

### **Phase 4: Update API Responses (Optional)**
Add computed `status` field to API responses for convenience

---

## 🎨 Visual Examples

### **Current UI:**
```
[Yes] [No] [Yes] [No]
```

### **New UI (3 States):**
```
[Redeemed] [Pending] [Missed] [Pending]
 (Green)    (Gray)    (Red)     (Gray)
```

### **Interaction:**
```
User sees: [Pending] (Gray chip)
User clicks → Changes to: [Redeemed] (Green chip)
User clicks again → Changes to: [Pending] or [Missed] based on date
```

---

## ⚡ Quick Start Implementation

**Minimal changes to get started:**

1. Add utility function (5 min)
2. Update one component (Coordinator Script Tab) (15 min)
3. Test (10 min)
4. Roll out to other tabs (10 min)

**Total time: ~40 minutes**

---

## 🤔 Open Questions

1. **Should users be able to manually mark future items as "missed"?**
   - Current rec: No, it's computed from date
   - Alternative: Allow with Option B (status column)

2. **What happens when user clicks a "missed" item?**
   - Option 1: Mark as redeemed (allow late completion)
   - Option 2: Cycle to pending (reset)
   - **Recommendation: Option 1** (allow late redemption)

3. **Should "missed" items disappear when filtering?**
   - Keep current behavior (showCompleted filter)
   - Add separate "Show Missed" filter
   - **Recommendation: Keep current behavior**

4. **Visual indicators beyond color?**
   - Add icons to chips (⭕ ✅ ❌)
   - Add strike-through for missed items
   - **Recommendation: Add icons**

---

## 📋 Implementation Checklist

- [ ] Create `getScheduleItemStatus()` utility function
- [ ] Update `StatusChip` component to use 3 states
- [ ] Update Coordinator Script Tab
- [ ] Update Coordinator To Do Tab
- [ ] Update Program Script Tab
- [ ] Update API responses (optional)
- [ ] Update TypeScript types
- [ ] Add documentation
- [ ] Test all three states
- [ ] Test date transitions (pending → missed)
- [ ] Test with different timezones
- [ ] User acceptance testing

---

## 🎉 Benefits

**For Users:**
- ✅ Better visibility into missed vs pending items
- ✅ Clear distinction between states
- ✅ Can see what's overdue at a glance
- ✅ More actionable information

**For You:**
- ✅ No database migration
- ✅ No breaking changes
- ✅ Easy to implement
- ✅ Low risk
- ✅ Can iterate quickly

---

**RECOMMENDATION: Go with computed status + enhanced chip toggle. It's the fastest, safest, and most user-friendly option.**

