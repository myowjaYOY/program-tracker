# Performance Validation Guide

## Quick Validation Steps

### 1. Browser DevTools Performance Testing

1. **Open Chrome DevTools** → Network tab
2. **Enable "Disable cache"** (to simulate first-time load)
3. **Throttle network** to "Fast 3G" or "Slow 3G" (to see real-world impact)
4. **Navigate to `/dashboard/leads`**
5. **Record metrics**:

#### Key Metrics to Check:

**Before Navigation:**
- Click "Clear" in Network tab
- Note the timestamp

**After Navigation:**
- **Time to First Byte (TTFB)**: First request response time
- **DOMContentLoaded**: When HTML is parsed
- **Load**: When all resources loaded
- **Largest Contentful Paint (LCP)**: When main content visible
- **Time to Interactive**: When page is interactive

#### What to Look For:

✅ **Good signs:**
- `loading.tsx` appears immediately (< 100ms)
- Page shell visible quickly
- Data loads progressively (you see skeleton → data)
- Total load time < 2 seconds

❌ **Bad signs:**
- Blank screen for > 500ms before loading skeleton
- All data loads at once (no progressive loading)
- Total load time > 3 seconds

### 2. React DevTools Profiler

1. **Install React DevTools** browser extension
2. **Open Profiler tab**
3. **Click "Record"**
4. **Navigate to `/dashboard/leads`**
5. **Stop recording** when page fully loads
6. **Review**:
   - Component render times
   - Which components take longest
   - Re-renders

### 3. API Route Performance

Test the API route directly:

```bash
# Time the API response
curl -w "\nTime: %{time_total}s\n" \
  -H "Cookie: your-session-cookie" \
  http://localhost:3000/api/leads
```

**Expected improvements:**
- Before: ~800ms - 1.2s
- After: ~200ms - 400ms (with parallel queries)

### 4. Lighthouse Audit

1. **Open Chrome DevTools** → Lighthouse tab
2. **Select "Performance"**
3. **Device**: Desktop or Mobile
4. **Click "Analyze page load"**
5. **Navigate to `/dashboard/leads`** and let it load
6. **Review scores**:
   - Performance score (aim for > 80)
   - First Contentful Paint (FCP) - should be < 1.8s
   - Largest Contentful Paint (LCP) - should be < 2.5s
   - Time to Interactive (TTI) - should be < 3.8s

### 5. Production Comparison

If you have production deployed:

1. **Test production `/dashboard/leads`** (old version)
   - Record metrics
   - Note load times
   - Check Network waterfall

2. **Deploy new version** to staging/preview
3. **Test staging `/dashboard/leads`** (new version)
   - Record same metrics
   - Compare side-by-side

### 6. Real User Monitoring (RUM)

If you have analytics:

- **Google Analytics**: Check "Page Load Time" report
- **Vercel Analytics**: Check Web Vitals dashboard
- **Custom RUM**: Track `performance.timing` API

## Performance Benchmarks

### Target Metrics (Good Performance)

| Metric | Target | Excellent |
|--------|--------|-----------|
| Time to First Byte (TTFB) | < 200ms | < 100ms |
| First Contentful Paint (FCP) | < 1.8s | < 1.0s |
| Largest Contentful Paint (LCP) | < 2.5s | < 1.5s |
| Time to Interactive (TTI) | < 3.8s | < 2.5s |
| Total Blocking Time (TBT) | < 200ms | < 100ms |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.05 |

### API Route Targets

| Endpoint | Before | Target | Status |
|----------|--------|--------|--------|
| `/api/leads` | ~800-1200ms | < 400ms | ✅ Optimized |

## Validation Checklist

Before applying to other pages, verify:

- [ ] **Instant feedback**: Loading skeleton appears immediately (< 100ms)
- [ ] **Progressive loading**: Page shell → skeleton → data (not all at once)
- [ ] **API performance**: `/api/leads` responds in < 400ms
- [ ] **No regressions**: All functionality works (CRUD, filters, etc.)
- [ ] **Lighthouse score**: Performance score > 80
- [ ] **User experience**: Page feels responsive and fast

## Quick Test Script

Run this in browser console on `/dashboard/leads`:

```javascript
// Performance timing
const perfData = performance.timing;
const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
const domReadyTime = perfData.domContentLoadedEventEnd - perfData.navigationStart;
const ttfb = perfData.responseStart - perfData.navigationStart;

console.log({
  'Time to First Byte': `${ttfb}ms`,
  'DOM Ready': `${domReadyTime}ms`,
  'Page Load': `${pageLoadTime}ms`,
});

// Web Vitals (if available)
if (window.webVitals) {
  // Log web vitals
}
```

## Next Steps After Validation

Once validated:

1. ✅ Document the improvements
2. ✅ Apply pattern to next high-traffic page (Dashboard)
3. ✅ Monitor production metrics
4. ✅ Iterate based on real-world data
