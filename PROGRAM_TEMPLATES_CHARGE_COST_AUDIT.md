# PROGRAM TEMPLATES - CHARGE VS COST CALCULATION AUDIT

**Date**: October 21, 2025  
**Scope**: Complete review of charge/cost calculations on program template pages  
**Objective**: Identify edge cases and potential out-of-sync scenarios

---

## EXECUTIVE SUMMARY

⚠️ **CRITICAL FINDINGS: 3 EDGE CASES IDENTIFIED**

The program template calculation system has **potential synchronization issues** that could lead to incorrect totals under specific scenarios.

### Risk Level: **MEDIUM** ⚠️

---

## 1. CALCULATION FLOW ANALYSIS

### 1.1 Current Architecture

**Data Flow**:
```
Template Items (with therapy_id, quantity)
    ↓
Therapies Table (cost, charge)
    ↓
API Route: updateTemplateCalculatedFields()
    ↓
calculateProgramTemplateTotals()
    ↓
calculateTemplateTotals() [from financial-calculations.ts]
    ↓
Update program_template table (total_cost, total_charge, margin_percentage)
```

### 1.2 Calculation Logic

**File**: `src/lib/utils/financial-calculations.ts` (Lines 180-201)

```typescript
export function calculateTemplateTotals(items: any[]): TemplateTotalsResult {
  let totalCost = 0;
  let totalCharge = 0;
  
  items.forEach(item => {
    const quantity = item.quantity || 1;
    const cost = item.item_cost || 0;
    const charge = item.item_charge || 0;
    
    totalCost += cost * quantity;
    totalCharge += charge * quantity;
  });
  
  // Templates don't have taxes or finance charges, so pass 0 for both
  const margin = calculateProjectedMargin(totalCharge, totalCost, 0, 0);
  
  return {
    totalCost,
    totalCharge,
    marginPercentage: margin
  };
}
```

✅ **VERIFIED**: Uses shared calculation function from source of truth

---

## 2. UPDATE TRIGGER POINTS

### 2.1 When Calculations Are Triggered

**Trigger Points** (All call `updateTemplateCalculatedFields()`):

1. **POST** `/api/program-templates/[id]/items` (Line 115)
   - When adding a new item to a template
   
2. **PUT** `/api/program-templates/[id]/items/[itemId]` (Line 62)
   - When updating an existing item (quantity, therapy_id, etc.)
   
3. **DELETE** `/api/program-templates/[id]/items/[itemId]` (Line 107)
   - When deleting an item from a template

### 2.2 What Gets Recalculated

**File**: `src/app/api/program-templates/[id]/items/route.ts` (Lines 127-182)

```typescript
async function updateTemplateCalculatedFields(supabase: any, templateId: number) {
  // 1. Fetch all ACTIVE items with therapy cost/charge
  const { data: items } = await supabase
    .from('program_template_items')
    .select('quantity, therapies(cost, charge)')
    .eq('program_template_id', templateId)
    .eq('active_flag', true);  // ⚠️ ONLY ACTIVE ITEMS

  // 2. Transform to calculation format
  const transformedItems = (items || []).map((item: any) => ({
    quantity: item.quantity || 1,
    item_cost: item.therapies?.cost || 0,      // ⚠️ READS FROM THERAPIES TABLE
    item_charge: item.therapies?.charge || 0,  // ⚠️ READS FROM THERAPIES TABLE
  }));

  // 3. Calculate totals
  const totals = calculateProgramTemplateTotals(transformedItems);

  // 4. Update template
  await supabase
    .from('program_template')
    .update({
      total_cost: totals.total_cost,
      total_charge: totals.total_charge,
      margin_percentage: totals.margin_percentage,
    })
    .eq('program_template_id', templateId);
}
```

✅ **VERIFIED**: Recalculates from scratch on every item change

---

## 3. EDGE CASE #1: THERAPY COST/CHARGE UPDATES ⚠️ **CRITICAL**

### 3.1 The Problem

**Scenario**: Admin updates a therapy's cost or charge in the Therapies table.

**Current Behavior**:
- Template items reference `therapy_id` (foreign key)
- Template totals are **NOT automatically recalculated**
- Templates become out-of-sync with current therapy prices

**Example**:
```
Initial State:
- Template has 5x "IV Therapy" (therapy_id=10)
- IV Therapy cost: $50, charge: $150
- Template total_cost: $250, total_charge: $750

Admin updates IV Therapy:
- New cost: $60, charge: $180

Result:
- Template items still reference therapy_id=10
- Template total_cost: $250 (WRONG - should be $300)
- Template total_charge: $750 (WRONG - should be $900)
- Template margin: 66.7% (WRONG - should be 66.7% but on wrong totals)
```

### 3.2 Root Cause

**No database trigger** on `therapies` table to update dependent templates.

**Files Checked**:
- `YOY Program Tracker.sql` - No trigger found for therapy updates affecting templates
- API routes - No webhook or cascade update logic

### 3.3 Impact

**Severity**: **HIGH** ⚠️

**Affected Operations**:
- Creating programs from templates (uses stale prices)
- Viewing template totals (shows incorrect values)
- Financial planning (based on incorrect data)

### 3.4 Current Workaround

**Manual Fix Required**:
1. Admin must manually edit each affected template item
2. Change quantity or therapy (triggers recalculation)
3. Change back to original value
4. This forces `updateTemplateCalculatedFields()` to run

**User Experience**: ❌ POOR - No indication that templates are stale

---

## 4. EDGE CASE #2: INACTIVE ITEMS ⚠️ **MEDIUM**

### 4.1 The Problem

**Scenario**: Admin sets a template item's `active_flag` to `false`.

**Current Behavior**:
```typescript
.eq('active_flag', true)  // Only includes active items
```

**Example**:
```
Initial State:
- Template has 3 items (all active)
- Item 1: $100 cost, $300 charge
- Item 2: $50 cost, $150 charge
- Item 3: $75 cost, $225 charge
- Total: $225 cost, $675 charge

Admin sets Item 2 to inactive (active_flag = false):

Result:
- Template items table still has 3 rows
- Calculation only includes Items 1 and 3
- Total: $175 cost, $525 charge (CORRECT for active items)
```

### 4.2 Analysis

**Is this correct behavior?**

**Arguments FOR current behavior**:
- ✅ Templates should only show "active" items that will be used
- ✅ Inactive items are like soft-deletes (archived but not removed)
- ✅ Matches the pattern used in member programs

**Arguments AGAINST**:
- ⚠️ UI doesn't clearly indicate inactive items are excluded from totals
- ⚠️ No visual indicator in the items grid showing item is inactive
- ⚠️ Admin might expect to see all items in the total

### 4.3 Current UI Behavior

**File**: `src/components/admin/program-templates/template-items-tab.tsx`

**Lines 74-86**:
```typescript
const mappedTemplateItems = templateItems.map(item => ({
  ...item,
  id: item.program_template_items_id,
  therapy_type_name: (item as any).therapies?.therapytype?.therapy_type_name || 'N/A',
  therapy_name: (item as any).therapies?.therapy_name || 'Unknown Therapy',
  bucket_name: (item as any).therapies?.buckets?.bucket_name || 'N/A',
  therapy_cost: (item as any).therapies?.cost || 0,
  therapy_charge: (item as any).therapies?.charge || 0,
  total_cost: ((item as any).therapies?.cost || 0) * (item.quantity || 1),  // ⚠️ CALCULATED IN UI
  total_charge: ((item as any).therapies?.charge || 0) * (item.quantity || 1),  // ⚠️ CALCULATED IN UI
}));
```

**Issue**: UI calculates `total_cost` and `total_charge` for **ALL items** (including inactive), but template totals only include **ACTIVE items**.

**Lines 204-222**: Columns show cost/charge for all items
```typescript
{
  field: 'total_cost',
  headerName: 'Cost',
  width: 100,
  type: 'number',
  renderCell: (params: any) => {
    const value = params.value || 0;
    return `$${value.toFixed(2)}`;  // Shows cost even if inactive
  },
},
{
  field: 'total_charge',
  headerName: 'Charge',
  width: 100,
  type: 'number',
  renderCell: (params: any) => {
    const value = params.value || 0;
    return `$${value.toFixed(2)}`;  // Shows charge even if inactive
  },
},
```

### 4.4 Recommendation

**Option A**: Keep current behavior, improve UI
- Add visual indicator (grayed out row, strikethrough, or badge) for inactive items
- Add tooltip: "Inactive items are excluded from template totals"
- Consider adding a "Show Inactive" toggle

**Option B**: Change calculation to include all items
- Remove `.eq('active_flag', true)` filter
- Include all items in totals regardless of active status
- Treat `active_flag` as metadata only

**Recommended**: **Option A** - Current behavior is correct, just needs better UI feedback

---

## 5. EDGE CASE #3: CONCURRENT UPDATES ⚠️ **LOW**

### 5.1 The Problem

**Scenario**: Two admins edit the same template simultaneously.

**Example Timeline**:
```
T0: Template has Item A ($100) and Item B ($50) = $150 total
T1: Admin 1 starts editing Item A
T2: Admin 2 adds Item C ($75)
T3: Admin 2's change saves → recalculates total = $225 ✓
T4: Admin 1 saves Item A change (quantity 1→2) → recalculates total
T5: Recalculation fetches: Item A (qty 2), Item B, Item C
T6: Total = $325 ✓
```

**Result**: ✅ **NO ISSUE** - Recalculation always fetches latest data

### 5.2 Analysis

**Why it works**:
- `updateTemplateCalculatedFields()` always queries fresh data
- Not using cached or stale values
- Each save triggers a full recalculation from database

**Potential race condition**:
- If two updates happen at **exact same millisecond**, last write wins
- Database handles this at transaction level
- Extremely unlikely in practice

### 5.3 Recommendation

✅ **NO ACTION NEEDED** - Current implementation is safe

---

## 6. EDGE CASE #4: DELETED THERAPIES ⚠️ **MEDIUM**

### 6.1 The Problem

**Scenario**: A therapy is deleted from the therapies table while still referenced by template items.

**Database Constraint**:
```sql
ALTER TABLE public.program_template_items
  ADD CONSTRAINT fk_therapy
  FOREIGN KEY (therapy_id) REFERENCES therapies(therapy_id);
```

**Behavior**: ❌ **DELETION BLOCKED** - Foreign key constraint prevents deletion

**But what if constraint is `ON DELETE CASCADE` or `ON DELETE SET NULL`?**

Currently: **No cascade behavior defined** → Deletion fails with FK violation

### 6.2 Current Protection

✅ **SAFE**: Cannot delete therapies that are referenced by template items

**Error Message** (from database):
```
ERROR: update or delete on table "therapies" violates foreign key constraint "fk_therapy" on table "program_template_items"
```

### 6.3 Recommendation

✅ **NO ACTION NEEDED** - Current FK constraint is correct

**Optional Enhancement**: Add UI validation in therapy delete API to show which templates are affected

---

## 7. DISPLAY CALCULATION DISCREPANCY ⚠️ **LOW**

### 7.1 The Issue

**File**: `src/components/admin/program-templates/template-items-tab.tsx` (Lines 84-85)

```typescript
total_cost: ((item as any).therapies?.cost || 0) * (item.quantity || 1),
total_charge: ((item as any).therapies?.charge || 0) * (item.quantity || 1),
```

**vs**

**File**: `src/lib/utils/financial-calculations.ts` (Lines 184-191)

```typescript
items.forEach(item => {
  const quantity = item.quantity || 1;
  const cost = item.item_cost || 0;
  const charge = item.item_charge || 0;
  
  totalCost += cost * quantity;
  totalCharge += charge * quantity;
});
```

### 7.2 Analysis

**Are they the same?**

✅ **YES** - Both use:
- `quantity || 1` (default to 1 if missing)
- `cost || 0` (default to 0 if missing)
- Simple multiplication: `cost * quantity`

**Difference**:
- UI calculation: Done client-side for display in grid
- API calculation: Done server-side for database storage

**Risk**: If UI and API use different default values, they could show different results

**Current State**: ✅ **CONSISTENT** - Both use same defaults

### 7.3 Recommendation

✅ **NO ACTION NEEDED** - Calculations are consistent

**Optional Enhancement**: Extract calculation to shared utility function to guarantee consistency

---

## 8. TEMPLATE INFO TAB - READ-ONLY DISPLAY

### 8.1 Current Implementation

**File**: `src/components/admin/program-templates/template-info-tab.tsx` (Lines 116-170)

```typescript
<TextField
  label="Total Cost"
  value={`$${(template.total_cost || 0).toFixed(2)}`}
  fullWidth
  InputProps={{ readOnly: true }}
  variant="outlined"
/>

<TextField
  label="Total Charge"
  value={`$${(template.total_charge || 0).toFixed(2)}`}
  fullWidth
  InputProps={{ readOnly: true }}
  variant="outlined"
/>

<TextField
  label="Margin Percentage"
  value={`${(template.margin_percentage || 0).toFixed(1)}%`}
  fullWidth
  InputProps={{ readOnly: true }}
  variant="outlined"
/>
```

### 8.2 Analysis

✅ **CORRECT**: These are read-only fields that display calculated values

**Data Source**: `template` prop passed from parent
- Comes from `useProgramTemplate()` hook
- Fetches from database via `/api/program-templates/[id]`
- Shows the stored calculated values

**Refresh Behavior**:
- React Query automatically refetches when items change (via mutation invalidation)
- Values update when user switches tabs or template

### 8.3 Recommendation

✅ **NO ACTION NEEDED** - Correctly displays calculated values

---

## 9. COMPARISON WITH MEMBER PROGRAMS

### 9.1 Similar Pattern

**Member Programs** also have calculated fields:
- `total_cost`
- `total_charge`
- Recalculated when items change

**File**: `src/app/api/member-programs/[id]/items/route.ts`

Similar `updateMemberProgramCalculatedFields()` function exists

### 9.2 Key Difference

**Member Programs**:
- Items store `item_cost` and `item_charge` directly (snapshot at creation time)
- Changes to therapy prices **don't affect existing programs** ✅ CORRECT
- Programs are locked to the prices at time of creation

**Templates**:
- Items reference `therapy_id` only
- Cost/charge come from therapies table at runtime
- Changes to therapy prices **should affect templates** but currently don't ⚠️

### 9.3 Design Question

**Should templates use snapshot or live prices?**

**Option A: Live Prices** (Current Intent)
- Templates always reflect current therapy prices
- Requires fixing Edge Case #1
- Pros: Always up-to-date, no stale data
- Cons: Templates change when therapies change

**Option B: Snapshot Prices** (Like Member Programs)
- Store `item_cost` and `item_charge` in template items
- Freeze prices at time of adding item to template
- Pros: Templates are stable, predictable
- Cons: Templates can become outdated

**Current Implementation**: Hybrid (unintentional)
- **Intended**: Live prices (references therapy_id)
- **Actual**: Snapshot (only recalculates on item changes)

### 9.4 Recommendation

**Decision Required**: Choose one approach explicitly

**Recommended**: **Option A (Live Prices)** + Fix Edge Case #1
- Add trigger or scheduled job to recalculate templates when therapies change
- Provides most value for templates (always current)
- Matches user expectation for templates vs programs

---

## 10. POTENTIAL OUT-OF-SYNC SCENARIOS

### Summary Table

| Scenario | Likelihood | Impact | Current State | Recommendation |
|----------|-----------|--------|---------------|----------------|
| **1. Therapy price change** | HIGH | HIGH | ❌ NOT HANDLED | FIX REQUIRED |
| **2. Inactive items** | MEDIUM | LOW | ⚠️ CONFUSING UI | IMPROVE UI |
| **3. Concurrent updates** | LOW | NONE | ✅ SAFE | NO ACTION |
| **4. Deleted therapies** | LOW | NONE | ✅ BLOCKED | NO ACTION |
| **5. Display calc mismatch** | NONE | NONE | ✅ CONSISTENT | NO ACTION |

---

## 11. RECOMMENDED FIXES

### Priority 1: Fix Therapy Price Updates ⚠️ **CRITICAL**

**Problem**: Templates don't recalculate when therapy prices change

**Solution Options**:

#### Option A: Database Trigger (Recommended)
```sql
CREATE OR REPLACE FUNCTION update_templates_on_therapy_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Find all templates that use this therapy
  UPDATE program_template pt
  SET 
    total_cost = (
      SELECT COALESCE(SUM(pti.quantity * t.cost), 0)
      FROM program_template_items pti
      JOIN therapies t ON t.therapy_id = pti.therapy_id
      WHERE pti.program_template_id = pt.program_template_id
        AND pti.active_flag = true
    ),
    total_charge = (
      SELECT COALESCE(SUM(pti.quantity * t.charge), 0)
      FROM program_template_items pti
      JOIN therapies t ON t.therapy_id = pti.therapy_id
      WHERE pti.program_template_id = pt.program_template_id
        AND pti.active_flag = true
    ),
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE pt.program_template_id IN (
    SELECT DISTINCT program_template_id
    FROM program_template_items
    WHERE therapy_id = NEW.therapy_id
  );
  
  -- Recalculate margin for affected templates
  UPDATE program_template pt
  SET margin_percentage = CASE
    WHEN pt.total_charge > 0 
    THEN ((pt.total_charge - pt.total_cost) / pt.total_charge) * 100
    ELSE 0
  END
  WHERE pt.program_template_id IN (
    SELECT DISTINCT program_template_id
    FROM program_template_items
    WHERE therapy_id = NEW.therapy_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_templates_on_therapy_change
AFTER UPDATE OF cost, charge ON therapies
FOR EACH ROW
WHEN (OLD.cost IS DISTINCT FROM NEW.cost OR OLD.charge IS DISTINCT FROM NEW.charge)
EXECUTE FUNCTION update_templates_on_therapy_change();
```

**Pros**:
- ✅ Automatic - no manual intervention needed
- ✅ Immediate - updates happen in same transaction
- ✅ Consistent - uses same calculation logic

**Cons**:
- ⚠️ Performance - could be slow if many templates use the therapy
- ⚠️ Complexity - adds database logic

#### Option B: API Endpoint + Manual Trigger
```typescript
// New API route: POST /api/admin/recalculate-templates
export async function POST(req: NextRequest) {
  // Recalculate all templates
  const { data: templates } = await supabase
    .from('program_template')
    .select('program_template_id');
  
  for (const template of templates) {
    await updateTemplateCalculatedFields(supabase, template.program_template_id);
  }
  
  return NextResponse.json({ success: true, count: templates.length });
}
```

**Add UI button**: "Recalculate All Templates" in admin section

**Pros**:
- ✅ Simple - reuses existing logic
- ✅ Controlled - admin decides when to run
- ✅ Visible - admin knows templates were updated

**Cons**:
- ❌ Manual - requires admin action
- ❌ Delay - templates are stale until admin runs it
- ❌ Forgettable - admin might forget to run it

#### Option C: Scheduled Job (Cron)
```typescript
// Vercel cron job: runs daily at 2 AM
// File: /api/cron/recalculate-templates
export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Recalculate all templates
  // ... same logic as Option B
}
```

**Pros**:
- ✅ Automatic - no manual intervention
- ✅ Scheduled - runs at low-traffic time
- ✅ Simple - reuses existing logic

**Cons**:
- ⚠️ Delayed - templates stale for up to 24 hours
- ⚠️ Unnecessary - runs even if no therapies changed

**RECOMMENDED**: **Option A (Database Trigger)** for immediate consistency

---

### Priority 2: Improve Inactive Items UI ⚠️ **MEDIUM**

**Problem**: No visual indicator that inactive items are excluded from totals

**Solution**:

```typescript
// In template-items-tab.tsx, modify the renderCell for active_flag column:
{
  field: 'active_flag',
  headerName: 'Status',
  width: 120,
  renderCell: (params: any) => {
    const isActive = params.value;
    return (
      <Tooltip 
        title={isActive 
          ? "Active - included in template totals" 
          : "Inactive - excluded from template totals"
        }
      >
        <Chip
          label={isActive ? 'Active' : 'Inactive'}
          size="small"
          color={isActive ? 'success' : 'default'}
          sx={{
            opacity: isActive ? 1 : 0.5,
          }}
        />
      </Tooltip>
    );
  },
},
```

**Also add**: Gray out entire row for inactive items
```typescript
getRowClassName={(params) => 
  params.row.active_flag === false ? 'inactive-row' : ''
}
```

```css
.inactive-row {
  opacity: 0.5;
  background-color: #f5f5f5;
}
```

---

### Priority 3: Add Therapy Update Warning (Optional)

**Problem**: No warning when editing therapy that's used in templates

**Solution**: Add check in therapy update API

```typescript
// In /api/therapies/[id]/route.ts PUT handler
if (body.cost !== undefined || body.charge !== undefined) {
  // Check if therapy is used in templates
  const { data: templateCount } = await supabase
    .from('program_template_items')
    .select('program_template_id', { count: 'exact', head: true })
    .eq('therapy_id', id)
    .eq('active_flag', true);
  
  if (templateCount && templateCount > 0) {
    // Add warning to response (don't block, just inform)
    return NextResponse.json({
      data,
      warning: `This therapy is used in ${templateCount} template(s). Template totals will be recalculated.`
    });
  }
}
```

---

## 12. TESTING RECOMMENDATIONS

### Test Case 1: Therapy Price Update
1. Create template with 2 items (Therapy A × 2, Therapy B × 3)
2. Note template totals
3. Update Therapy A cost from $50 to $60
4. Verify template total_cost increases by $20 (2 × $10)
5. Verify margin recalculates correctly

**Expected**: ✅ If trigger implemented, totals update automatically  
**Current**: ❌ Totals remain stale

### Test Case 2: Inactive Item
1. Create template with 3 items (total $300)
2. Set middle item to inactive (value $100)
3. Verify template total shows $200
4. Verify UI clearly indicates item is inactive
5. Verify item row is visually distinct

**Expected**: ✅ Total excludes inactive item  
**Current**: ✅ Calculation correct, ⚠️ UI unclear

### Test Case 3: Concurrent Edits
1. Open template in two browser tabs
2. Tab 1: Edit item quantity
3. Tab 2: Add new item
4. Save Tab 2 first, then Tab 1
5. Verify final totals include both changes

**Expected**: ✅ Both changes reflected  
**Current**: ✅ Works correctly

---

## 13. CONCLUSION

### Summary of Findings

**✅ STRENGTHS**:
1. Uses shared calculation functions (consistent with member programs)
2. Recalculates on every item change (add/update/delete)
3. Protected against deleted therapies (FK constraint)
4. Safe against concurrent updates (fresh data fetch)

**⚠️ WEAKNESSES**:
1. **CRITICAL**: Templates don't update when therapy prices change
2. **MEDIUM**: Inactive items UI is confusing
3. **LOW**: No warning when editing therapies used in templates

### Risk Assessment

| Risk | Likelihood | Impact | Priority |
|------|-----------|--------|----------|
| Stale template prices | **HIGH** | **HIGH** | **P1** |
| User confusion (inactive items) | **MEDIUM** | **LOW** | **P2** |
| Incorrect financial planning | **MEDIUM** | **HIGH** | **P1** |

### Recommended Action Plan

1. **Immediate** (P1): Implement database trigger for therapy price updates
2. **Short-term** (P2): Improve inactive items UI with visual indicators
3. **Optional** (P3): Add therapy update warnings

---

**Report Status**: ✅ COMPLETE  
**Next Steps**: Review findings with team and prioritize fixes  
**Estimated Fix Time**: 
- P1 (Trigger): 4-6 hours (development + testing)
- P2 (UI): 2-3 hours (development + testing)

