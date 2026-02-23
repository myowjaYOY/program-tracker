# Performance Optimization Guide

## Overview

This guide documents the performance optimizations implemented to improve page loading speed and user experience.

## Key Improvements

### 1. Server-Side Rendering (SSR) for Initial Data Load

**Problem**: Pages were client-side only, requiring users to wait for data to load before seeing any content.

**Solution**: Converted pages to Server Components that fetch data on the server, enabling:
- Immediate page shell rendering
- Faster initial page load
- Better SEO
- Reduced client-side JavaScript execution

**Pattern**:
```typescript
// Server Component (page.tsx)
export default async function Page() {
  const data = await getData(); // Server-side fetch
  return <ClientComponent initialData={data} />;
}

// Client Component (receives pre-fetched data)
'use client';
export function ClientComponent({ initialData }) {
  const { data } = useQuery({ initialData }); // Hydrates React Query
  // ... render UI
}
```

### 2. Optimized API Routes

**Problem**: N+1 query issues and sequential database queries causing slow API responses.

**Solution**: 
- Parallel query execution using `Promise.all()`
- Single queries instead of per-item queries
- Better use of Supabase joins and aggregations

**Example - Before**:
```typescript
// Sequential queries - slow
const leads = await fetchLeads();
const noteCounts = await fetchNoteCounts(leadIds);
const followUpNotes = await fetchFollowUpNotes(leadIds);
```

**Example - After**:
```typescript
// Parallel queries - fast
const [leads, notes, followUpNotes] = await Promise.all([
  fetchLeads(),
  fetchNoteCounts(leadIds),
  fetchFollowUpNotes(leadIds),
]);
```

### 3. Progressive Loading with Suspense

**Problem**: Pages blocked rendering until all data loaded.

**Solution**: Use React Suspense boundaries to show loading states for individual sections while other parts render.

**Pattern**:
```typescript
<Suspense fallback={<Skeleton />}>
  <DataComponent />
</Suspense>
```

## Implementation Checklist

When optimizing a new page:

1. ✅ **Create server-side data fetching function** (`src/lib/data/[entity].ts`)
   - Use `createClient()` from `@/lib/supabase/server`
   - Optimize queries (parallel execution, reduce N+1)
   - Return typed data

2. ✅ **Convert page to Server Component** (`src/app/dashboard/[entity]/page.tsx`)
   - Remove `'use client'` directive
   - Make component `async`
   - Fetch data using server-side function
   - Wrap client component in Suspense

3. ✅ **Create client component wrapper** (`src/components/[entity]/[entity]-page-client.tsx`)
   - Add `'use client'` directive
   - Accept `initialData` prop
   - Pass to child components

4. ✅ **Update table/form components** to accept `initialData`
   - Pass to React Query hooks via `initialData` option
   - React Query will hydrate and then refetch in background

5. ✅ **Optimize API route** (`src/app/api/[entity]/route.ts`)
   - Use `Promise.all()` for parallel queries
   - Eliminate N+1 queries
   - Use efficient Supabase queries

## Database Optimization Opportunities

### Recommended SQL Optimizations

1. **Create Materialized Views** for frequently accessed aggregations:
```sql
CREATE MATERIALIZED VIEW lead_notes_summary AS
SELECT 
  lead_id,
  COUNT(*) as note_count,
  MAX(CASE WHEN note_type = 'Follow-Up' THEN note END) as last_followup_note
FROM lead_notes
GROUP BY lead_id;

CREATE INDEX ON lead_notes_summary(lead_id);
```

2. **Add Indexes** for common query patterns:
```sql
CREATE INDEX idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX idx_lead_notes_type_created ON lead_notes(note_type, created_at DESC);
```

3. **Use Database Functions** for complex aggregations:
```sql
CREATE OR REPLACE FUNCTION get_lead_metadata(lead_ids INTEGER[])
RETURNS TABLE (
  lead_id INTEGER,
  note_count BIGINT,
  last_followup_note TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ln.lead_id,
    COUNT(*)::BIGINT as note_count,
    (SELECT note FROM lead_notes 
     WHERE lead_id = ln.lead_id 
     AND note_type = 'Follow-Up' 
     ORDER BY created_at DESC LIMIT 1) as last_followup_note
  FROM lead_notes ln
  WHERE ln.lead_id = ANY(lead_ids)
  GROUP BY ln.lead_id;
END;
$$ LANGUAGE plpgsql;
```

## Performance Metrics

### Before Optimization
- **Time to First Contentful Paint**: ~2-3 seconds
- **Time to Interactive**: ~4-5 seconds
- **API Response Time**: ~800ms-1.2s (leads page)

### After Optimization (Expected)
- **Time to First Contentful Paint**: ~0.5-1 second
- **Time to Interactive**: ~1-2 seconds
- **API Response Time**: ~200-400ms (leads page)

## Next Steps

1. **Apply pattern to other high-traffic pages**:
   - Dashboard page
   - Member Programs page
   - Reports pages

2. **Implement database optimizations**:
   - Create materialized views for aggregations
   - Add strategic indexes
   - Consider database functions for complex queries

3. **Monitor and measure**:
   - Use Next.js Analytics
   - Monitor API response times
   - Track Core Web Vitals

4. **Consider additional optimizations**:
   - React Query prefetching for navigation
   - Image optimization
   - Code splitting for large components
   - CDN for static assets
