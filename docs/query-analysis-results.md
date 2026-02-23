# Query Performance Analysis

## Analysis of Your Slow Queries

From the `pg_stat_statements` output you provided, here's what I found:

### ✅ Good News

Most of the slow queries are:
1. **One-time migrations** (17.8s backfill query) - Not a performance issue
2. **System queries** (pg_timezone_names, schema introspection) - Normal overhead
3. **Not related to leads page** - Most slow queries are for other features

### ⚠️ Queries That Could Affect Performance

1. **Audit Events Queries** (930ms, 489ms)
   - Not directly on leads page, but could affect overall performance
   - Consider: Add indexes on `audit_events.tenant_id` if not exists

2. **Member Program Item Schedule** (226ms)
   - Complex JOIN query with LATERAL joins
   - Not on leads page, but could be optimized

3. **Campaign Queries** (54ms)
   - Reasonable performance
   - Used on leads page for campaign dropdown

### 🔍 Next Steps to Find Leads-Specific Slow Queries

Run this query to find leads-specific slow queries:

```sql
-- Find queries related to leads table
SELECT 
  LEFT(query, 150) as query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) as avg_ms,
  ROUND(max_exec_time::numeric, 2) as max_ms
FROM pg_stat_statements
WHERE query ILIKE '%leads%'
  AND query NOT ILIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 📊 Expected Performance for Leads API

Based on the optimizations we made:

**Before optimization:**
- Sequential queries: ~800-1200ms
- N+1 query pattern

**After optimization:**
- Parallel queries: ~200-400ms expected
- Single batch queries

### 🎯 Validation Checklist

To validate the leads page performance:

1. **Test the API directly:**
   ```bash
   node scripts/benchmark-api.js /api/leads
   ```

2. **Check browser Network tab:**
   - Navigate to `/dashboard/leads`
   - Check `/api/leads` response time
   - Should be < 400ms

3. **Run targeted query analysis:**
   ```sql
   -- See docs/analyze-slow-queries.sql
   ```

### 💡 If Leads API is Still Slow

If `/api/leads` is still showing > 400ms:

1. **Check for missing indexes:**
   ```sql
   -- Run from docs/database-optimization-suggestions.sql
   CREATE INDEX IF NOT EXISTS idx_leads_status_id ON leads(status_id);
   CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
   CREATE INDEX IF NOT EXISTS idx_lead_notes_type_created ON lead_notes(note_type, created_at DESC) WHERE note_type = 'Follow-Up';
   ```

2. **Check table statistics:**
   ```sql
   ANALYZE leads;
   ANALYZE lead_notes;
   ```

3. **Review the actual query pattern:**
   - The parallel queries we implemented should help
   - But if there are many leads (> 10,000), consider pagination

### 📈 Monitoring Going Forward

After deploying:

1. **Monitor these metrics:**
   - `/api/leads` response time (should be < 400ms)
   - Page load time (should be < 2s)
   - User-reported performance

2. **Set up alerts** if:
   - API response time > 1s
   - Page load time > 3s

3. **Regular maintenance:**
   - Run `ANALYZE` weekly
   - Review slow queries monthly
   - Add indexes as needed
