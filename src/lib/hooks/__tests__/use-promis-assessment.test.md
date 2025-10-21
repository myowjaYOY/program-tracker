# PROMIS Assessment Hook - Test Documentation

## Hook: `usePromisAssessmentData(memberId)`

### Purpose
Fetches PROMIS-29 assessment data for a member using React Query

### Usage
```typescript
import { usePromisAssessmentData } from '@/lib/hooks/use-promis-assessment';

function MyComponent() {
  const { summary, domains, isLoading, error } = usePromisAssessmentData(memberId);
  
  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;
  
  return <PromisAssessment summary={summary} domains={domains} />;
}
```

### Return Value
```typescript
{
  // Data
  summary: PromisAssessmentSummary | undefined;
  domains: PromisDomainCard[] | undefined;
  
  // Loading states
  isLoading: boolean;
  isFetching: boolean;
  
  // Error state
  error: Error | null;
  
  // Refetch function
  refetch: () => Promise<...>;
}
```

### Test Cases

#### 1. No Member ID
```typescript
const { summary, domains, isLoading } = usePromisAssessmentData(null);
// Expected: isLoading = false, summary = undefined, domains = undefined
```

#### 2. Valid Member ID
```typescript
const { summary, domains, isLoading } = usePromisAssessmentData(123);
// Expected: 
// - isLoading = true initially
// - Then fetches from /api/report-card/promis-assessment/123
// - Returns summary and 8 domain cards
```

#### 3. Error Handling
```typescript
const { error } = usePromisAssessmentData(999); // Non-existent member
// Expected: error.message = "No PROMIS-29 surveys found for this member"
```

### Caching Behavior
- **Stale Time:** 10 minutes
- **Cache Key:** `['promis-assessment', 'assessment', memberId]`
- **Refetch:** Automatic on window focus (React Query default)

### Integration Points
- **API Route:** `/api/report-card/promis-assessment/[memberId]`
- **Types:** `PromisAssessmentSummary`, `PromisDomainCard`
- **Components:** Will be used by `PromisAssessmentTab`

### Differences from MSQ Hook
1. **Simpler:** Only one endpoint (no food triggers or clinical plan)
2. **Same Pattern:** Follows exact same structure as MSQ
3. **Same Caching:** 10-minute stale time
4. **Same Error Handling:** Throws on fetch failure

### Manual Test Steps
1. Open browser DevTools → Network tab
2. Navigate to Report Card page
3. Select a member with PROMIS data
4. Switch to PROMIS-29 tab
5. Verify:
   - ✅ Network request to `/api/report-card/promis-assessment/[id]`
   - ✅ Loading state shows initially
   - ✅ Data populates after fetch
   - ✅ Switching away and back uses cache (no new request)
   - ✅ After 10 minutes, new request on focus

### Status
✅ **READY FOR USE**
- TypeScript: Compiled successfully
- Linting: No errors
- Pattern: Matches MSQ hook exactly

