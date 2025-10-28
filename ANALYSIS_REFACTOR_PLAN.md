# Member Progress Analysis Refactoring Plan

**DATE**: 2025-10-26  
**GOAL**: Decouple analysis logic from import function to enable on-demand re-analysis

---

## **CURRENT STATE ANALYSIS**

### **Import Function Structure** (`process-survey-import/index.ts`)
**Total Lines**: ~1871 lines

**IMPORT LOGIC (STAYS):**
- `handleFileUpload()` - Main import orchestrator
- `handleStatusCheck()` - Job status endpoint
- `parseCSV()` - CSV parsing
- `parseCSVLine()` - CSV line parsing
- `processSurveyData()` - Core import logic (creates sessions, responses)
- `calculateDomainScores()` - MSQ/PROMIS domain scoring
- `updateJobStatus()` - Job status updates
- `convertPromisAnswerToNumeric()` - PROMIS scoring helper

**ANALYSIS LOGIC (EXTRACT TO NEW FUNCTION):**
- `calculateMemberProgressDashboards()` - Main dashboard orchestrator (line 1147)
- `calculateMemberMetrics()` - Core analysis function (line 1223)
- `getModuleSequence()` - Fetch module order (line 1105)
- `calculateHealthVitals()` - Energy, mood, motivation, wellbeing, sleep (line 1382)
- `calculateCompliance()` - Nutrition, supplements, exercise, meditation (line 1454)
- `extractAlerts()` - Wins & challenges extraction (line 1537)
- `calculateTimelineProgress()` - Curriculum timeline (line 1625)
- `extractWeightData()` - Weight tracking (line 1697)
- `extractGoals()` - SMART goals extraction (line 1749)
- `calculateStatusIndicator()` - Overall status (line 1787)
- `calculateTrend()` - Trend calculation helper (line 1822)
- `getDefaultMetrics()` - Default metric values (line 1832)

**CRITICAL INTEGRATION POINT:**
- Line 853: `await calculateMemberProgressDashboards(supabase, jobId);`
- This will be replaced with a call to the new analysis edge function

---

## **NEW ARCHITECTURE**

### **1. New Edge Function**: `analyze-member-progress`

**Purpose**: Standalone analysis function that can run on-demand or after imports

**Capabilities**:
- Re-analyze ALL members (64 current members)
- Re-analyze specific member(s) by lead_id
- Return analysis results with success/failure counts
- Use same analysis logic as current implementation

**Invocation Methods**:
1. **Automatic**: Called by import function after successful batch
2. **On-Demand**: Triggered by admin UI button
3. **Programmatic**: Can be called via API for testing/debugging

**Input Payload**:
```json
{
  "mode": "all" | "specific" | "batch",
  "lead_ids": [1, 2, 3],        // For "specific" mode
  "import_batch_id": 123         // For "batch" mode (called after import)
}
```

**Output Response**:
```json
{
  "success": true,
  "analyzed_count": 64,
  "failed_count": 0,
  "duration_seconds": 28.5,
  "errors": []
}
```

---

### **2. Updated Import Function**: `process-survey-import`

**Changes**:
1. **REMOVE**: All 12 analysis functions listed above (~700 lines)
2. **ADD**: HTTP call to new `analyze-member-progress` function after successful import
3. **KEEP**: All import logic unchanged (CSV parsing, data insertion, domain scoring)

**New Integration Code** (replaces lines 850-860):
```typescript
// Calculate member progress dashboards via separate analysis function
try {
  console.log('Triggering member progress analysis...');
  
  // Call the analysis edge function
  const analysisUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-member-progress`;
  const response = await fetch(analysisUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mode: 'batch',
      import_batch_id: jobId
    })
  });

  if (!response.ok) {
    throw new Error(`Analysis function returned ${response.status}`);
  }

  const analysisResult = await response.json();
  console.log('Member progress analysis completed:', analysisResult);
} catch (dashboardError) {
  console.error('Dashboard calculation failed:', dashboardError);
  console.error('Dashboard error details:', dashboardError.message);
  // Don't fail the entire import - just log the error
}
```

---

### **3. Admin UI**: Re-Analysis Button

**Location**: `src/app/dashboard/admin/analytics/page.tsx` (new page) OR add to existing admin page

**Features**:
- Button: "Re-analyze All Member Dashboards"
- Shows progress indicator while running
- Displays results (success count, errors)
- Includes timestamp of last analysis

**UI Components**:
```typescript
<Card>
  <CardHeader title="Member Progress Dashboards" />
  <CardContent>
    <Typography variant="body2" color="textSecondary" gutterBottom>
      Re-analyze all member dashboards to apply updated classification logic.
      This will process {memberCount} members.
    </Typography>
    
    <Button 
      variant="contained" 
      onClick={handleReanalyze}
      disabled={isAnalyzing}
    >
      {isAnalyzing ? 'Analyzing...' : 'Re-analyze All Dashboards'}
    </Button>
    
    {result && (
      <Alert severity="success" sx={{ mt: 2 }}>
        Successfully analyzed {result.analyzed_count} members in {result.duration_seconds}s
      </Alert>
    )}
  </CardContent>
</Card>
```

**API Route**: `src/app/api/admin/reanalyze-dashboards/route.ts`

---

## **IMPLEMENTATION STEPS** (Sequential, Review Each)

### **Step 1: Create New Analysis Edge Function** ✅
1. Create `supabase/functions/analyze-member-progress/index.ts`
2. Copy all 12 analysis functions from import function
3. Add main handler with mode support (all/specific/batch)
4. Add progress logging
5. **REVIEW**: Verify all functions copied correctly
6. **REVIEW**: Check no dependencies on import-specific code

### **Step 2: Test New Analysis Function** ✅
1. Deploy new function (separate from import)
2. Test in isolation with mode="all"
3. Verify dashboards are updated correctly
4. **REVIEW**: Compare output with current dashboard data
5. **DO NOT TOUCH IMPORT FUNCTION YET**

### **Step 3: Update Import Function** ✅
1. Replace analysis orchestrator call (line 853) with HTTP fetch to new function
2. Remove all 12 analysis functions (~700 lines)
3. Keep all import logic unchanged
4. **REVIEW**: Verify import logic untouched
5. **REVIEW**: Verify only analysis code removed
6. **TRIPLE CHECK**: No accidental deletions of import logic

### **Step 4: Test Updated Import Function** ✅
1. Deploy updated import function
2. Test with real CSV file
3. Verify import still works correctly
4. Verify analysis is triggered automatically
5. **REVIEW**: Check import job status, error handling

### **Step 5: Create Admin UI** ✅
1. Create API route for re-analysis trigger
2. Create admin page with button
3. Add to admin navigation
4. Test full flow: Click button → See results

### **Step 6: Documentation** ✅
1. Update `docs/dashboard-metrics-and-business-rules.md`
2. Document new architecture
3. Document how to trigger re-analysis
4. Document troubleshooting steps

---

## **SAFETY CHECKS** (Before Each Deployment)

### **Import Function Safety Checklist**:
- [ ] All CSV parsing logic unchanged
- [ ] `processSurveyData()` function intact
- [ ] `calculateDomainScores()` function intact
- [ ] Session creation logic unchanged
- [ ] Response insertion logic unchanged
- [ ] Program/module auto-creation logic unchanged
- [ ] Error handling unchanged
- [ ] Job status updates unchanged
- [ ] Only analysis functions removed
- [ ] New analysis function call added correctly

### **Analysis Function Safety Checklist**:
- [ ] All 12 analysis functions present
- [ ] No import-specific dependencies
- [ ] Can run standalone (no jobId required for "all" mode)
- [ ] Proper error handling
- [ ] Supabase client created correctly
- [ ] Returns meaningful results

---

## **ROLLBACK PLAN**

If anything goes wrong:

1. **Import Function Broken**:
   - Git revert to current version
   - Redeploy immediately
   - Analysis will be missing but imports will work

2. **Analysis Function Broken**:
   - Only affects dashboard updates
   - Imports continue working
   - Fix analysis function separately

3. **Both Broken** (unlikely):
   - Git revert entire change
   - Redeploy original import function
   - Reassess approach

---

## **EXPECTED BENEFITS**

✅ **Refine logic anytime** - No waiting for imports  
✅ **Re-analyze historical data** - Single button click  
✅ **Fast iteration** - Test changes in seconds  
✅ **Import function stability** - Less code = fewer bugs  
✅ **Clear separation of concerns** - Import vs Analysis  

---

## **RISKS & MITIGATIONS**

| Risk | Mitigation |
|------|------------|
| Break import function | Extensive testing, careful code review |
| Analysis function doesn't work | Test standalone before integrating |
| Performance issues (64 members) | Add progress logging, optimize queries |
| HTTP call timeout | Set appropriate timeout, handle gracefully |
| Race conditions | Use atomic upserts, proper locking |

---

## **REVIEW QUESTIONS** (Answer Before Proceeding)

1. ✅ Does this plan preserve all import functionality?
2. ✅ Are all 12 analysis functions identified correctly?
3. ✅ Is the integration point (line 853) correct?
4. ✅ Will automatic analysis still work after imports?
5. ✅ Can we re-analyze all 64 members on-demand?
6. ✅ Is the rollback plan clear?
7. ✅ Are safety checks comprehensive?

---

**STATUS**: ⏸️ **AWAITING APPROVAL TO PROCEED**

**NEXT**: Step 1 - Create new analysis edge function (no changes to import yet)

