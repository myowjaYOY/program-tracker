# Step 3: Import Function Modification Plan

**DATE**: 2025-10-26  
**FILE**: `supabase/functions/process-survey-import/index.ts`  
**RISK**: 🔴 **HIGH** (Production import function)

---

## **WHAT WE'RE CHANGING**

### **REMOVE (Lines 1081-1871)**:
1. Lines 1081-1095: `FALLBACK_MODULE_SEQUENCE` constant
2. Lines 1105-1145: `getModuleSequence()` function
3. Lines 1147-1214: `calculateMemberProgressDashboards()` function
4. Lines 1223-1377: `calculateMemberMetrics()` function
5. Lines 1382-1449: `calculateHealthVitals()` function
6. Lines 1454-1532: `calculateCompliance()` function
7. Lines 1537-1611: `extractAlerts()` function
8. Lines 1625-1691: `calculateTimelineProgress()` function
9. Lines 1697-1744: `extractWeightData()` function
10. Lines 1749-1782: `extractGoals()` function
11. Lines 1787-1817: `calculateStatusIndicator()` function
12. Lines 1822-1827: `calculateTrend()` function
13. Lines 1832-1871: `getDefaultMetrics()` function

**Total Lines to Remove**: ~790 lines

### **REPLACE (Lines 850-860)**:
Current code:
```typescript
// Calculate member progress dashboards (runs for ALL batches, including duplicates/backfills)
try {
  console.log('Starting member progress dashboard calculations...');
  await calculateMemberProgressDashboards(supabase, jobId);
  console.log('Member progress dashboard calculations completed successfully');
} catch (dashboardError) {
  console.error('Dashboard calculation failed:', dashboardError);
  console.error('Dashboard error details:', dashboardError.message);
  console.error('Dashboard error stack:', dashboardError.stack);
  // Don't fail the entire import - just log the error
}
```

New code:
```typescript
// Calculate member progress dashboards via separate analysis function
try {
  console.log('Triggering member progress analysis...');
  
  // Call the analysis edge function
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const analysisUrl = `${supabaseUrl}/functions/v1/analyze-member-progress`;
  
  const response = await fetch(analysisUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mode: 'batch',
      import_batch_id: jobId
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Analysis function returned ${response.status}: ${errorText}`);
  }

  const analysisResult = await response.json();
  console.log(`Member progress analysis completed: ${analysisResult.analyzed_count} members, ${analysisResult.duration_seconds}s`);
} catch (dashboardError) {
  console.error('Dashboard calculation failed:', dashboardError);
  console.error('Dashboard error details:', dashboardError.message);
  // Don't fail the entire import - just log the error
}
```

---

## **WHAT WE'RE KEEPING** (Verification Checklist)

### ✅ Core Import Functions (MUST REMAIN UNCHANGED):
- [ ] `handleFileUpload()` - Lines 189-333
- [ ] `handleStatusCheck()` - Lines 335-368
- [ ] `parseCSV()` - Lines 370-399
- [ ] `parseCSVLine()` - Lines 401-421
- [ ] `processSurveyData()` - Lines 423-863
- [ ] `calculateDomainScores()` - Lines 865-1039
- [ ] `updateJobStatus()` - Lines 1041-1079
- [ ] `convertPromisAnswerToNumeric()` - Lines 43-178

### ✅ Main Handler (MUST REMAIN UNCHANGED):
- [ ] Deno.serve() - Lines 119-187

### ✅ Interfaces (MUST REMAIN UNCHANGED):
- [ ] `SurveyResponseRow` - Lines 9-19
- [ ] `ImportJobResult` - Lines 21-28
- [ ] `QuestionDomainMapping` - Lines 30-34

---

## **PRE-MODIFICATION CHECKLIST**

Before making ANY changes:

### 1. Backup Current Version:
```bash
cp supabase/functions/process-survey-import/index.ts supabase/functions/process-survey-import/index.ts.backup-step3
```

### 2. Verify Line Numbers:
- [ ] Confirm `FALLBACK_MODULE_SEQUENCE` starts at line 1081
- [ ] Confirm `getDefaultMetrics()` ends at line 1871
- [ ] Confirm `calculateMemberProgressDashboards` call is at line 853
- [ ] Confirm total file is 1871 lines

### 3. Identify Integration Point:
- [ ] Line 853: `await calculateMemberProgressDashboards(supabase, jobId);`
- [ ] This is inside `processSurveyData()` function
- [ ] Comes after `calculateDomainScores()` (lines 840-847)
- [ ] Comes before `return result;` (line 862)

---

## **MODIFICATION SEQUENCE**

### Step 3A: Replace Integration Point (Lines 850-860)
1. Read lines 840-865 to see context
2. Replace lines 850-860 with new HTTP fetch code
3. Verify no syntax errors

### Step 3B: Remove Analysis Functions (Lines 1081-1871)
1. Remove lines 1081-1871 (all 12 functions + constant)
2. Verify file ends with proper closing of previous function
3. Verify no dangling brackets or syntax errors

### Step 3C: Verify Imports
1. Check if any imports need to be added (none needed)
2. Verify existing imports remain intact

---

## **POST-MODIFICATION VERIFICATION**

### 1. Code Review Checklist:
- [ ] All import functions present (8 functions)
- [ ] Main handler intact
- [ ] Integration point replaced correctly
- [ ] No dangling code or references to removed functions
- [ ] Proper error handling maintained
- [ ] No syntax errors (check for unmatched braces, etc.)

### 2. Line Count Verification:
- **Before**: 1871 lines
- **Expected After**: ~1080 lines (removed ~790 lines)
- **Actual After**: _____ lines

### 3. Function Count Verification:
- **Before**: 20 functions
- **Expected After**: 8 functions (removed 12 analysis functions)
- **Actual After**: _____ functions

### 4. Search for Removed Function References:
```bash
grep -n "calculateMemberMetrics" index.ts          # Should be: 0 matches
grep -n "calculateHealthVitals" index.ts            # Should be: 0 matches
grep -n "FALLBACK_MODULE_SEQUENCE" index.ts         # Should be: 0 matches
grep -n "getModuleSequence" index.ts                # Should be: 0 matches
```

---

## **DEPLOYMENT CHECKLIST**

### Before Deployment:
- [ ] All verifications passed
- [ ] Backup created
- [ ] No syntax errors
- [ ] Integration code tested locally (if possible)

### Deployment Command:
```bash
npx supabase functions deploy process-survey-import --project-ref mxktlbhiknpdauzoitnm --no-verify-jwt
```

### Post-Deployment Verification:
- [ ] Function deployed successfully
- [ ] No deployment errors
- [ ] Ready for Step 4 (test with real CSV)

---

## **ROLLBACK PLAN**

If ANYTHING goes wrong:

### Immediate Rollback:
```bash
# Restore backup
cp supabase/functions/process-survey-import/index.ts.backup-step3 supabase/functions/process-survey-import/index.ts

# Redeploy
npx supabase functions deploy process-survey-import --project-ref mxktlbhiknpdauzoitnm --no-verify-jwt
```

### Verification After Rollback:
```bash
# Test import still works
# Upload a test CSV file
# Verify data appears in database
```

---

## **STATUS**: ⏸️ **READY TO BEGIN**

**Next Action**: Execute Step 3A - Replace Integration Point

**Approval Required**: YES - This is a critical modification to production code

