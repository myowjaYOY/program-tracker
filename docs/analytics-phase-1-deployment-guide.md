# Analytics Dashboard - Phase 1 Deployment Guide

**Created:** 2025-11-07  
**Status:** Ready for Testing  
**Phase:** 1 - Data Pipeline & Foundation

---

## 📦 What We Built

### **New Database Objects Created:**

1. **Table:** `member_analytics_cache`
   - Stores pre-calculated analytics metrics
   - JSONB fields for complex data structures
   - Indexed for fast retrieval

2. **Function:** `calculate_analytics_metrics()`
   - Calculates all analytics metrics
   - Returns success status and performance metrics
   - ~5-10 seconds for 100 members

3. **Function:** `get_latest_analytics_cache()`
   - Helper function to retrieve most recent cache
   - Used internally

### **New API Endpoints Created:**

1. **GET `/api/analytics/metrics`**
   - Fetches latest pre-calculated analytics
   - Returns 404 if no cache exists
   - Fast response (<100ms)

2. **POST `/api/analytics/refresh`**
   - Triggers calculation of analytics
   - Long-running (5-10 seconds)
   - Returns calculation stats

3. **GET `/api/analytics/refresh`**
   - Check cache status (age, last updated)
   - Useful for UI status indicators

### **New React Hooks Created:**

1. **`useAnalyticsMetrics()`**
   - Fetches analytics from cache
   - 10-minute stale time

2. **`useRefreshAnalytics()`**
   - Mutation to trigger refresh
   - Auto-invalidates cache on success

3. **`useAnalyticsRefreshStatus()`**
   - Gets cache age and status
   - For "Last updated: X hours ago" UI

---

## 🚀 Deployment Steps

### **Step 1: Deploy Database Objects**

Run these SQL files in **Supabase SQL Editor** in this exact order:

1. **Create Table:**
   ```sql
   -- File: sql/create_member_analytics_cache.sql
   -- Run this first
   ```

2. **Create Functions:**
   ```sql
   -- File: sql/create_calculate_analytics_function.sql
   -- Run this second
   ```

**Verification:**
```sql
-- Verify table exists
SELECT * FROM member_analytics_cache LIMIT 1;

-- Verify function exists
SELECT proname FROM pg_proc WHERE proname = 'calculate_analytics_metrics';
```

---

### **Step 2: Initial Data Population**

After deploying the database objects, populate the cache:

**Option A: Via SQL Editor**
```sql
SELECT * FROM calculate_analytics_metrics();
```

**Option B: Via API (after deploying Next.js code)**
```bash
curl -X POST http://localhost:3000/api/analytics/refresh \
  -H "Cookie: <your-auth-cookie>"
```

---

### **Step 3: Deploy Next.js Code**

The following files are ready to commit and deploy:

**New Files:**
- `src/app/api/analytics/metrics/route.ts`
- `src/app/api/analytics/refresh/route.ts`
- `src/lib/hooks/use-analytics-metrics.ts`
- `docs/analytics-dashboard-implementation-plan.md`
- `docs/analytics-phase-1-deployment-guide.md`

**Build Check:**
```bash
npm run build
```

**Expected:** Build should succeed with no errors.

---

## 🧪 Testing Plan

### **Test 1: Database Function**

**Goal:** Verify SQL function calculates metrics correctly

**Steps:**
```sql
-- Step 1: Call the function
SELECT * FROM calculate_analytics_metrics();

-- Expected output:
-- success | message                          | calculation_time_ms | members_analyzed
-- --------|----------------------------------|---------------------|------------------
-- true    | Analytics calculated success...  | 5234                | 100

-- Step 2: Verify cache was created
SELECT 
  cache_id,
  calculated_at,
  member_count,
  active_member_count,
  completed_member_count,
  compliance_msq_correlation,
  compliance_promis_correlation
FROM member_analytics_cache
ORDER BY calculated_at DESC
LIMIT 1;

-- Expected: One row with real data
```

**What to Check:**
- ✅ Function completes without errors
- ✅ `member_count` matches expected number of members
- ✅ `active_member_count` seems reasonable
- ✅ Correlation values are between -1 and 1 (or NULL)
- ✅ `calculation_duration_ms` is reasonable (<30 seconds)

---

### **Test 2: API Endpoints**

**Prerequisites:** 
- Database objects deployed
- Cache populated (run Test 1 first)
- Next.js app running (`npm run dev`)
- Authenticated user session

**Test 2A: GET /api/analytics/metrics**

```bash
# Using curl (replace with your session cookie)
curl http://localhost:3000/api/analytics/metrics \
  -H "Cookie: <your-auth-cookie>" \
  | jq '.'

# Expected response:
{
  "data": {
    "cache_id": 1,
    "calculated_at": "2025-11-07T...",
    "member_count": 100,
    "active_member_count": 75,
    "compliance_msq_correlation": 0.456,
    "compliance_promis_correlation": 0.523,
    ...
  }
}
```

**Test 2B: POST /api/analytics/refresh**

```bash
curl -X POST http://localhost:3000/api/analytics/refresh \
  -H "Cookie: <your-auth-cookie>" \
  | jq '.'

# Expected response (may take 5-10 seconds):
{
  "data": {
    "success": true,
    "message": "Analytics calculated successfully. Cache ID: 2, Duration: 5234ms",
    "calculation_time_ms": 5234,
    "members_analyzed": 100,
    "total_api_time_ms": 5456
  }
}
```

**Test 2C: GET /api/analytics/refresh (status check)**

```bash
curl http://localhost:3000/api/analytics/refresh \
  -H "Cookie: <your-auth-cookie>" \
  | jq '.'

# Expected response:
{
  "data": {
    "has_cache": true,
    "cache_id": 2,
    "calculated_at": "2025-11-07T...",
    "cache_age": "0h 5m",
    "calculation_duration_ms": 5234,
    "member_count": 100
  }
}
```

---

### **Test 3: React Hooks**

**Goal:** Verify hooks work in UI

**Create test page:** `src/app/dashboard/analytics-test/page.tsx`

```typescript
'use client';

import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { useAnalyticsMetrics, useRefreshAnalytics, useAnalyticsRefreshStatus } from '@/lib/hooks/use-analytics-metrics';

export default function AnalyticsTestPage() {
  const { data: metrics, isLoading, error } = useAnalyticsMetrics();
  const { data: status } = useAnalyticsRefreshStatus();
  const refreshMutation = useRefreshAnalytics();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Analytics Test Page</Typography>
      
      {/* Status */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6">Cache Status:</Typography>
        {status?.has_cache ? (
          <>
            <Typography>Last Updated: {status.calculated_at}</Typography>
            <Typography>Cache Age: {status.cache_age}</Typography>
            <Typography>Members: {status.member_count}</Typography>
          </>
        ) : (
          <Typography>No cache exists yet</Typography>
        )}
      </Box>

      {/* Refresh Button */}
      <Button 
        variant="contained" 
        onClick={() => refreshMutation.mutate()}
        disabled={refreshMutation.isPending}
      >
        {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Analytics'}
      </Button>

      {/* Metrics Display */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6">Analytics Metrics:</Typography>
        {isLoading && <CircularProgress />}
        {error && <Typography color="error">{error.message}</Typography>}
        {metrics && (
          <>
            <Typography>Total Members: {metrics.member_count}</Typography>
            <Typography>Active Members: {metrics.active_member_count}</Typography>
            <Typography>Completed Members: {metrics.completed_member_count}</Typography>
            <Typography>
              Compliance vs MSQ Correlation: {metrics.compliance_msq_correlation?.toFixed(3) ?? 'N/A'}
            </Typography>
            <Typography>
              Compliance vs PROMIS Correlation: {metrics.compliance_promis_correlation?.toFixed(3) ?? 'N/A'}
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
```

**Navigate to:** `http://localhost:3000/dashboard/analytics-test`

**Expected:**
- ✅ Page loads without errors
- ✅ Cache status displays correctly
- ✅ Click "Refresh Analytics" triggers calculation
- ✅ After refresh, metrics update automatically
- ✅ Correlation values display (or N/A if no data)

---

## 📊 Data Validation

### **Correlation Values - What to Expect:**

**Compliance vs. MSQ Improvement:**
- **Expected Range:** 0.3 to 0.7 (moderate to strong positive correlation)
- **Interpretation:** Higher compliance → Greater MSQ improvement (lower scores)
- **If Negative:** Unexpected, needs investigation
- **If Near Zero:** Weak relationship, may need more data

**Compliance vs. PROMIS Improvement:**
- **Expected Range:** 0.2 to 0.6 (weak to moderate positive correlation)
- **Interpretation:** Higher compliance → Greater PROMIS improvement (lower T-scores)
- **Note:** PROMIS may be less sensitive than MSQ

### **Member Counts:**

Check these ratios:
- Active members should be 50-80% of total
- Completed members should be 20-40% of total
- If counts don't match expectations, verify `ProgramStatusService` logic

---

## 🐛 Troubleshooting

### **Issue: "No analytics cache found"**

**Cause:** Cache table is empty  
**Solution:** Run `SELECT * FROM calculate_analytics_metrics();`

---

### **Issue: Function returns NULL correlations**

**Possible Causes:**
1. No members have both compliance data AND MSQ/PROMIS assessments
2. No members have first+last assessments (need at least 2)
3. All members have identical scores (no variance)

**Diagnosis:**
```sql
-- Check how many members have both compliance and MSQ data
SELECT COUNT(*) 
FROM member_progress_summary mps
WHERE mps.status_score IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM survey_domain_scores sds
    INNER JOIN survey_response_sessions srs ON srs.session_id = sds.session_id
    WHERE srs.lead_id = mps.lead_id AND srs.form_id = 3
  );
```

---

### **Issue: Function times out**

**Cause:** Too many members or complex queries  
**Solution:** 
1. Check `calculation_duration_ms` in cache
2. If >30 seconds, may need to optimize queries
3. Consider adding indexes to `survey_domain_scores` and `survey_response_sessions`

---

### **Issue: API returns 401 Unauthorized**

**Cause:** Not authenticated  
**Solution:** 
1. Log in to the application first
2. Use browser DevTools → Network tab to get auth cookie
3. Or test via authenticated browser session

---

## ✅ Success Criteria

Phase 1 is complete when:

- ✅ Database table and functions deploy without errors
- ✅ `calculate_analytics_metrics()` runs successfully
- ✅ Correlation values are calculated (or NULL with valid reason)
- ✅ API endpoints return data correctly
- ✅ React hooks fetch and display data
- ✅ Test page works end-to-end
- ✅ No TypeScript or linter errors
- ✅ Build succeeds

---

## 📝 Next Steps (Phase 2)

After Phase 1 validation:

1. **Expand SQL Function:**
   - Add Tab 1 metrics (compliance distribution, timeline)
   - Add Tab 3 metrics (at-risk members, bottlenecks)
   - Add Tab 4 metrics (PROMIS deep dive)
   - Add Tab 5 metrics (temporal trends)

2. **Build Analytics Dashboard UI:**
   - Create `/dashboard/analytics` page
   - Implement 5 tabs
   - Build chart components

3. **Scheduling:**
   - Add database trigger after survey imports
   - OR set up pg_cron daily refresh

---

## 🎯 Current Status

**Phase 1 Progress:**
- ✅ Database schema created
- ✅ SQL functions created
- ✅ API endpoints created
- ✅ React hooks created
- ✅ No linter errors
- ⏳ **PENDING:** Real data testing and validation

**Ready for:** Testing with real Supabase data

**Blocked by:** User approval to run SQL in production database












