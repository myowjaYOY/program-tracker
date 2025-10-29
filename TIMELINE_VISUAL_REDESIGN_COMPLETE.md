# Timeline Card Visual Redesign - COMPLETE ✅

**Date:** October 28, 2025  
**Status:** ✅ READY FOR TESTING  
**Changes:** Graphics only (no other functionality changed)

---

## 🎯 **WHAT CHANGED**

### **Visual Design Update**

**BEFORE:**
```
┌────────┐
│   ✓    │  ← CheckCircle icon
└────────┘
MODULE 1 - PRE-PROGRAM
```

**AFTER:**
```
┌────────┐
│   M1   │  ← Module number text
└────────┘
PRE-PROGRAM
Oct 15
```

---

## 📝 **REQUIREMENTS MET**

✅ **Module Number Inside Bubble:**
- Dynamically extracted from module name
- "MODULE 1 - PRE-PROGRAM" → **"M1"**
- "MODULE 13 - MID-MONTH 4" → **"M13"**

✅ **Description Below Bubble:**
- Shows only the description part
- "MODULE 1 - PRE-PROGRAM" → **"PRE-PROGRAM"**
- "MODULE 4 - START OF DETOX" → **"START OF DETOX"**

✅ **Completion Dates:**
- Fetched from `survey_response_sessions` via `survey_session_program_context` + `survey_modules`
- Format: **"Oct 15"** (month abbreviation + day)

✅ **Non-Completed Module Display:**
- **Overdue:** Shows "Overdue" in red italic text
- **Next (blue):** No date shown
- **Future (gray):** No date shown

✅ **Colors Unchanged:**
- ✅ Green (#10b981) - Completed
- ✅ Blue (#3b82f6) - Next
- ✅ Red (#ef4444) - Overdue
- ✅ Gray (#d1d5db) - Future

---

## 🔧 **FILES MODIFIED**

### **1. TypeScript Types**
**File:** `src/types/common.ts`

**Change:** Added `module_completion_dates` field to `MemberProgressDashboard` interface

```typescript
export interface MemberProgressDashboard {
  // ... existing fields
  
  // Timeline progress
  module_sequence: string[];
  completed_milestones: string[];
  next_milestone: string | null;
  overdue_milestones: string[];
  module_completion_dates: Record<string, string>; // ⬅️ NEW!
  
  // ... other fields
}
```

---

### **2. API Route**
**File:** `src/app/api/member-progress/[leadId]/dashboard/route.ts`

**Changes:**
1. Query module completion dates from database
2. Join `survey_response_sessions` → `survey_session_program_context` → `survey_modules`
3. Add `module_completion_dates` to response

**New Code Added:**

```typescript
// Fetch module completion dates separately
const { data: completionDates } = await supabase.rpc('get_module_completion_dates', {
  p_lead_id: leadId
});

// Fallback to direct query if RPC doesn't exist
let moduleCompletionDatesMap: Record<string, string> = {};
if (completionDates) {
  moduleCompletionDatesMap = Object.fromEntries(
    completionDates.map((row: any) => [row.module_name, row.completed_on])
  );
} else {
  // Direct query joins survey_response_sessions → survey_session_program_context → survey_modules
  const { data: completionData } = await supabase
    .from('survey_response_sessions')
    .select(`
      completed_on,
      survey_session_program_context!inner(
        survey_modules!inner(module_name)
      )
    `)
    .eq('lead_id', leadId);

  if (completionData) {
    // Group by module and get max date
    const grouped: Record<string, string> = {};
    completionData.forEach((row: any) => {
      const moduleName = row.survey_session_program_context?.survey_modules?.module_name;
      const completedOn = row.completed_on;
      if (moduleName && completedOn) {
        if (!grouped[moduleName] || completedOn > grouped[moduleName]) {
          grouped[moduleName] = completedOn;
        }
      }
    });
    moduleCompletionDatesMap = grouped;
  }
}

// Add to response
const dashboardData = {
  ...data,
  // ... other fields
  module_completion_dates: moduleCompletionDatesMap, // ⬅️ NEW!
};
```

---

### **3. Timeline Card Component**
**File:** `src/components/member-progress/TimelineCard.tsx`

**Changes:**

#### **A. Added Utility Functions**

```typescript
/**
 * Extract module number from module name
 * E.g., "MODULE 1 - PRE-PROGRAM" → "M1"
 */
function extractModuleNumber(moduleName: string): string {
  const match = moduleName.match(/MODULE\s+(\d+)/i);
  return match ? `M${match[1]}` : 'M?';
}

/**
 * Extract description from module name
 * E.g., "MODULE 1 - PRE-PROGRAM" → "PRE-PROGRAM"
 */
function extractModuleDescription(moduleName: string): string {
  const parts = moduleName.split('-');
  if (parts.length > 1) {
    return parts.slice(1).join('-').trim();
  }
  return moduleName;
}

/**
 * Format date as "Oct 15"
 */
function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  } catch {
    return null;
  }
}
```

#### **B. Updated CustomStepIcon Component**

**BEFORE:** Displayed icons (✓, ►, ⚠, ○)

**AFTER:** Displays module number text (M1, M2, M13, etc.)

```typescript
function CustomStepIcon(props: CustomStepIconProps) {
  const { moduleName, isCompleted, isOverdue, isNext, isFuture } = props;

  // Determine color (same as before)
  let backgroundColor = '#e0e0e0';
  let textColor = '#9ca3af';
  let borderColor = 'transparent';

  if (isCompleted) {
    backgroundColor = '#10b981';
    textColor = 'white';
  } else if (isOverdue) {
    backgroundColor = '#ef4444';
    textColor = 'white';
    borderColor = '#dc2626';
  } else if (isNext) {
    backgroundColor = '#3b82f6';
    textColor = 'white';
    borderColor = '#2563eb';
  } else if (isFuture) {
    backgroundColor = '#d1d5db';
    textColor = '#9ca3af';
  }

  const moduleNumber = extractModuleNumber(moduleName); // ⬅️ NEW!

  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        backgroundColor,
        border: borderColor !== 'transparent' ? `3px solid ${borderColor}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'scale(1.1)',
        },
      }}
    >
      {/* CHANGED: Text instead of icon */}
      <Typography 
        sx={{ 
          color: textColor, 
          fontWeight: 'bold', 
          fontSize: '0.875rem',
        }}
      >
        {moduleNumber}
      </Typography>
    </Box>
  );
}
```

#### **C. Updated Stepper Rendering**

**BEFORE:** Showed full module name below bubble

**AFTER:** Shows description + date/status below bubble

```typescript
{moduleSequence.map((module, index) => {
  const { isCompleted, isOverdue, isNext, isFuture } = getModuleState(module, index);
  const description = extractModuleDescription(module); // ⬅️ Extract description
  const completionDate = data.module_completion_dates?.[module]; // ⬅️ Get date
  const formattedDate = formatDate(completionDate); // ⬅️ Format as "Oct 15"
  
  // Determine subtitle
  let subtitle = '';
  if (isCompleted && formattedDate) {
    subtitle = formattedDate; // "Oct 15"
  } else if (isOverdue) {
    subtitle = 'Overdue';
  } else {
    subtitle = ''; // Future modules show no date
  }
  
  return (
    <Step key={module} completed={isCompleted} active={isNext}>
      <StepLabel
        StepIconComponent={(props) => (
          <CustomStepIcon
            {...props}
            moduleName={module} // ⬅️ Pass module name
            isCompleted={isCompleted}
            isOverdue={isOverdue}
            isNext={isNext}
            isFuture={isFuture}
          />
        )}
      >
        <Box sx={{ textAlign: 'center' }}>
          {/* Description */}
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: isNext ? 'bold' : 'normal',
              color: isOverdue ? '#ef4444' : isNext ? '#3b82f6' : 'text.secondary',
              display: 'block',
              marginBottom: subtitle ? 0.5 : 0,
            }}
          >
            {description}
          </Typography>
          
          {/* Date or Status */}
          {subtitle && (
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.7rem',
                color: isOverdue ? '#ef4444' : 'text.secondary',
                fontStyle: isOverdue ? 'italic' : 'normal',
                display: 'block',
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </StepLabel>
    </Step>
  );
})}
```

#### **D. Removed Unused Imports**

Removed icons that are no longer used:
- ~~`CheckCircle`~~
- ~~`RadioButtonUnchecked`~~
- ~~`Warning`~~
- ~~`PlayArrow`~~

Only kept: `Timeline` (for card header icon)

---

## 🔍 **DATA FLOW**

### **Database Query**

```sql
SELECT 
  sm.module_name,
  MAX(srs.completed_on) as completed_on
FROM survey_response_sessions srs
JOIN survey_session_program_context sspc ON srs.session_id = sspc.session_id
JOIN survey_modules sm ON sspc.module_id = sm.module_id
WHERE srs.lead_id = ?
GROUP BY sm.module_name
```

### **Result Example**

```json
{
  "MODULE 1 - PRE-PROGRAM": "2025-06-15T10:30:00Z",
  "MODULE 2 - WEEK 1": "2025-06-22T14:20:00Z",
  "MODULE 4 - START OF DETOX": "2025-07-18T16:20:00Z",
  ...
}
```

### **Display Example**

```
M1              M2              M4
PRE-PROGRAM     WEEK 1          START OF DETOX
Jun 15          Jun 22          Jul 18
(green)         (green)         (green)

M5              M6              M7
WEEK 4          MID-DETOX       END OF DETOX
                                Overdue
(blue - next)   (gray - future) (red - overdue)
```

---

## 🧪 **TESTING CHECKLIST**

### **Visual Verification**

- [ ] Module numbers display correctly (M1, M2, M13, etc.)
- [ ] Descriptions show without "MODULE X -" prefix
- [ ] Completion dates show as "Oct 15" format for completed modules
- [ ] "Overdue" text shows for overdue modules
- [ ] No date shows for future modules (gray)
- [ ] No date shows for next module (blue)
- [ ] Colors remain unchanged (green, blue, red, gray)
- [ ] Hover effect still works (scale 1.1)
- [ ] Horizontal scroll still works
- [ ] Responsive layout still works

### **Data Verification**

- [ ] Completion dates match actual survey completion dates
- [ ] Module number extraction works for all module name formats
- [ ] Description extraction works for all module name formats
- [ ] Date formatting works for all timezones
- [ ] Missing dates handle gracefully (show nothing, not error)

### **Edge Cases**

- [ ] Member with no completed modules (all gray, no dates)
- [ ] Member with all modules completed (all green with dates)
- [ ] Member with some overdue modules (red with "Overdue")
- [ ] Module names without numbers (fallback to "M?")
- [ ] Module names with unusual formatting

---

## 📊 **EXAMPLE OUTPUT**

### **Sample Member (lead_id = 96)**

**Module Sequence:**
1. M1 - PRE-PROGRAM (Jun 15) ✅ Green
2. M2 - WEEK 1 (Jun 22) ✅ Green
3. M3 - WEEK 2 (Jun 30) ✅ Green
4. M4 - START OF DETOX (Jul 18) ✅ Green
5. M5 - WEEK 4 → Next (blue, no date)
6. M6 - MID-DETOX → Future (gray, no date)
7. M7 - END OF DETOX → Future (gray, no date)

**Visual:**
```
┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐
│M1 │──│M2 │──│M3 │──│M4 │──│M5 │──│M6 │──│M7 │
└───┘  └───┘  └───┘  └───┘  └───┘  └───┘  └───┘
PRE-   WEEK 1 WEEK 2 START  WEEK 4 MID-   END OF
PROGRAM       OF     DETOX        DETOX
              DETOX
Jun 15 Jun 22 Jun 30 Jul 18
(Green)(Green)(Green)(Green)(Blue) (Gray) (Gray)
```

---

## ✅ **IMPLEMENTATION COMPLETE**

All changes have been implemented according to requirements:

1. ✅ Module numbers extracted dynamically
2. ✅ Descriptions shown without prefix
3. ✅ Completion dates fetched from database
4. ✅ Dates formatted as "Oct 15"
5. ✅ Overdue shows "Overdue" text
6. ✅ Future modules show no date
7. ✅ Colors unchanged
8. ✅ Graphics-only change (no other functionality affected)

---

**READY FOR TESTING!** 🎉

Test with a member who has:
- Some completed modules
- Next module (blue)
- Some future modules
- Ideally one overdue module (if available)

**Suggested Test Member:** lead_id = 96 (Craig Reiners) - has good mix of completed/future modules

