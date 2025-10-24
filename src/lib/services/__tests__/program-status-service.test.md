# Program Status Service - Test Documentation

## Manual Test Cases

Since this service interacts with the database, these tests should be run manually or with integration testing.

### Test Case 1: Default Behavior (Active Only)
```typescript
const programIds = await ProgramStatusService.getValidProgramIds(supabase);
// Expected: Only programs with status = 'Active'
```

### Test Case 2: Include Paused Programs
```typescript
const programIds = await ProgramStatusService.getValidProgramIds(supabase, {
  includeStatuses: ['paused']
});
// Expected: Programs with status = 'Active' OR 'Paused'
```

### Test Case 3: Include All Programs
```typescript
const programIds = await ProgramStatusService.getValidProgramIds(supabase, {
  includeStatuses: ['all']
});
// Expected: All programs regardless of status
```

### Test Case 4: Filter by Member
```typescript
const programIds = await ProgramStatusService.getValidProgramIds(supabase, {
  memberId: 123,
  includeStatuses: ['paused']
});
// Expected: Only programs for member 123 with status = 'Active' OR 'Paused'
```

### Test Case 5: Multiple Exceptions
```typescript
const programIds = await ProgramStatusService.getValidProgramIds(supabase, {
  includeStatuses: ['paused', 'quote']
});
// Expected: Programs with status = 'Active' OR 'Paused' OR 'Quote'
```

### Test Case 6: Check Single Program Validity
```typescript
const isValid = await ProgramStatusService.isProgramValid(supabase, 123);
// Expected: true if program 123 has status = 'Active', false otherwise
```

### Test Case 7: Get Status IDs
```typescript
const statusIds = await ProgramStatusService.getValidStatusIds(supabase, {
  includeStatuses: ['paused']
});
// Expected: Array of status_id values for 'Active' and 'Paused'
```

## Edge Cases to Test

1. **No programs in database** - Should return empty array
2. **No statuses in database** - Should return empty array with warning
3. **Invalid member ID** - Should return empty array
4. **Database error** - Should return empty array and log error
5. **Case sensitivity** - Status names should be case-insensitive

## Integration Test Example

To test in the browser console or API route:

```typescript
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

const supabase = await createClient();

// Test 1: Default
console.log('Active only:', await ProgramStatusService.getValidProgramIds(supabase));

// Test 2: With Paused
console.log('Active + Paused:', await ProgramStatusService.getValidProgramIds(supabase, {
  includeStatuses: ['paused']
}));

// Test 3: All
console.log('All programs:', await ProgramStatusService.getValidProgramIds(supabase, {
  includeStatuses: ['all']
}));
```

