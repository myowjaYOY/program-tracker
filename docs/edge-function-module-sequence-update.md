# Edge Function Update: Dynamic Module Sequence

## Date
October 26, 2025

## Summary
Updated the `process-survey-import` edge function to read the module sequence dynamically from the `survey_modules` database table instead of using a hardcoded constant.

---

## Changes Made

### 1. **Created `getModuleSequence()` Function**

**Location**: `supabase/functions/process-survey-import/index.ts` (Lines 1096-1144)

**Purpose**: Queries the `survey_modules` table to get the ordered list of module names for a specific program.

**Key Features**:
- ✅ Queries `survey_modules` table filtered by `program_id` and `active_flag`
- ✅ Handles two sorting strategies:
  - Uses `module_order` column if populated
  - Falls back to extracting numbers from "MODULE X - ..." pattern if `module_order` is null
- ✅ Robust error handling with fallback to hardcoded constant
- ✅ Logs success/failure for debugging

**Signature**:
```typescript
async function getModuleSequence(supabase: any, programId: number): Promise<string[]>
```

---

### 2. **Renamed Constant to Fallback**

**Before**:
```typescript
const MODULE_SEQUENCE = [...]
```

**After**:
```typescript
const FALLBACK_MODULE_SEQUENCE = [...]
```

**Purpose**: 
- Clarifies this is a fallback/safety net
- Used only if database query fails
- Maintains system resilience

---

### 3. **Updated `calculateMemberProgressDashboards()`**

**Location**: `supabase/functions/process-survey-import/index.ts` (Line 1146)

**Changes**:
- Fetches module sequence from database **once per import batch** (line 1153)
- Passes the dynamic sequence to all member calculations
- Logs the number of modules loaded

**Code**:
```typescript
// Fetch module sequence from database (query once per batch)
const MODULE_SEQUENCE = await getModuleSequence(supabase, 2);
console.log(`Using module sequence with ${MODULE_SEQUENCE.length} modules`);
```

**Current Limitation**: Hardcoded to `program_id = 2` (4 Month AIP Program)
**Future Enhancement**: Make dynamic based on member's actual program

---

### 4. **Updated `calculateMemberMetrics()`**

**Location**: `supabase/functions/process-survey-import/index.ts` (Line 1219)

**Changes**:
- Added `moduleSequence` parameter to function signature
- Passes sequence to `calculateTimelineProgress()`

**Updated Signature**:
```typescript
async function calculateMemberMetrics(
  supabase: any, 
  leadId: number, 
  moduleSequence: string[]
)
```

---

### 5. **Updated `calculateTimelineProgress()`**

**Location**: `supabase/functions/process-survey-import/index.ts` (Line 1569)

**Changes**:
- Added `moduleSequence` parameter to function signature
- Replaced all references to global `MODULE_SEQUENCE` with parameter `moduleSequence`
- Updated documentation with parameter description

**Updated Signature**:
```typescript
function calculateTimelineProgress(
  userProgress: any | null, 
  sessions: any[], 
  moduleSequence: string[]
)
```

---

## Benefits

### ✅ **Single Source of Truth**
- Database is now the authoritative source for module sequence
- No more risk of code-database sync issues

### ✅ **No Redeployment for Curriculum Changes**
- Module names can be updated in `survey_modules` table
- Changes automatically reflected on next import batch
- No code changes or edge function redeployment needed

### ✅ **Multi-Program Support (Future)**
- Architecture now supports different programs with different module sequences
- Only needs removal of hardcoded `program_id = 2`
- Can query based on member's actual program

### ✅ **Handles Variations**
- Supports bonus modules (e.g., "[BONUS] HORMONE MODULE")
- Adapts to curriculum evolution
- Works with different module naming conventions

### ✅ **Resilient**
- Fallback constant ensures system keeps working even if DB query fails
- Comprehensive error handling and logging
- No breaking changes to existing functionality

---

## Performance Impact

**Minimal**: One additional database query per import batch (not per member)

- Query runs **once** at the start of `calculateMemberProgressDashboards()`
- Result is reused for all members in that batch
- Typical batch size: 1-50 members
- Query overhead: ~10-50ms (negligible compared to total processing time)

**Trade-off**: Worth it for the flexibility and maintainability benefits

---

## Testing Recommendations

1. **Verify fallback works**:
   - Temporarily break DB query (wrong table name)
   - Confirm fallback sequence is used
   - Check logs for error message

2. **Test with actual data**:
   - Import a new survey batch
   - Check `member_progress_summary` for correct timeline data
   - Verify overdue/next milestone calculations

3. **Test module_order handling**:
   - Current state: All `module_order` values are NULL
   - Function handles this by parsing "MODULE X" pattern
   - If `module_order` is populated in future, test that path too

---

## Future Enhancements

### 1. **Dynamic Program Detection**
Replace:
```typescript
const MODULE_SEQUENCE = await getModuleSequence(supabase, 2);
```

With:
```typescript
// Detect member's program from survey_user_progress
const { data: progress } = await supabase
  .from('survey_user_progress')
  .select('program_id')
  .eq('mapping_id', mappingId)
  .maybeSingle();

const programId = progress?.program_id || 2; // Default to 2
const MODULE_SEQUENCE = await getModuleSequence(supabase, programId);
```

### 2. **Caching for Performance**
If module sequences rarely change:
```typescript
// Cache module sequences by program_id
const moduleSequenceCache = new Map<number, string[]>();

async function getCachedModuleSequence(supabase: any, programId: number) {
  if (!moduleSequenceCache.has(programId)) {
    const sequence = await getModuleSequence(supabase, programId);
    moduleSequenceCache.set(programId, sequence);
  }
  return moduleSequenceCache.get(programId)!;
}
```

### 3. **Module Order Enforcement**
Update `survey_modules` table to populate `module_order` column:
```sql
UPDATE survey_modules
SET module_order = CAST(SUBSTRING(module_name FROM 'MODULE ([0-9]+)') AS INTEGER)
WHERE program_id = 2;
```

This would make sorting more explicit and reliable.

---

## Related Documentation

- Module sequence source: `docs/member-journey-and-surveys.md`
- Form-to-module mapping: `docs/survey-forms-to-modules-relationship.md`
- Business rules: `docs/dashboard-metrics-and-business-rules.md`

---

## Deployment Notes

**No immediate redeployment required** - The edge function is already deployed and working.

When ready to deploy these changes:
```bash
supabase functions deploy process-survey-import
```

**Risk Level**: Low
- Changes are backwards compatible
- Fallback mechanism ensures no breaking changes
- Extensive error handling prevents failures

---

## Author Notes

This architectural change moves us from a rigid, code-based curriculum definition to a flexible, data-driven approach. It's a best practice for systems where the business logic (curriculum structure) should be configurable without code changes.

The trade-off of one extra DB query per batch is negligible compared to the operational benefits of being able to adjust curriculum without redeployment.

