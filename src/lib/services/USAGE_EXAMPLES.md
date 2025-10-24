# Program Status Service - Usage Examples

## Overview

The `ProgramStatusService` is the single source of truth for determining which programs are "valid" for system operations.

**Default Rule:** Only **Active** programs are considered valid.

**Exceptions:** Components can request additional statuses when needed.

---

## Common Usage Patterns

### 1. API Routes - Get Valid Programs for Operations

**90% Case - Default (Active Only):**
```typescript
import { ProgramStatusService } from '@/lib/services/program-status-service';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  
  // Get only Active programs
  const validProgramIds = await ProgramStatusService.getValidProgramIds(supabase);
  
  if (validProgramIds.length === 0) {
    return NextResponse.json({ data: [] });
  }
  
  // Use in your query
  const { data: items } = await supabase
    .from('member_program_items')
    .select('*')
    .in('member_program_id', validProgramIds);
  
  return NextResponse.json({ data: items });
}
```

### 2. Coordinator Operations - Include Paused Programs

**10% Case - Active + Paused:**
```typescript
import { ProgramStatusService } from '@/lib/services/program-status-service';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');
  
  // Get Active + Paused programs (operational programs)
  const validProgramIds = await ProgramStatusService.getValidProgramIds(supabase, {
    memberId: memberId ? Number(memberId) : undefined,
    includeStatuses: ['paused']  // Exception: also include Paused
  });
  
  if (validProgramIds.length === 0) {
    return NextResponse.json({ data: [] });
  }
  
  const { data: schedule } = await supabase
    .from('member_program_item_schedule')
    .select('*')
    .in('member_program_id', validProgramIds);
  
  return NextResponse.json({ data: schedule });
}
```

### 3. Audit/Reporting - Include All Programs

**10% Case - All Statuses:**
```typescript
import { ProgramStatusService } from '@/lib/services/program-status-service';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  
  // Get ALL programs for audit trail
  const validProgramIds = await ProgramStatusService.getValidProgramIds(supabase, {
    includeStatuses: ['all']  // Exception: include everything
  });
  
  const { data: auditLogs } = await supabase
    .from('vw_audit_member_items')
    .select('*')
    .in('program_id', validProgramIds);
  
  return NextResponse.json({ data: auditLogs });
}
```

### 4. Using Status IDs Instead of Program IDs

**When you need to filter by status directly:**
```typescript
import { ProgramStatusService } from '@/lib/services/program-status-service';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  
  // Get status IDs for Active + Paused
  const validStatusIds = await ProgramStatusService.getValidStatusIds(supabase, {
    includeStatuses: ['paused']
  });
  
  // Query programs directly by status
  const { data: programs } = await supabase
    .from('member_programs')
    .select('*, leads(*), program_status(*)')
    .in('program_status_id', validStatusIds);
  
  return NextResponse.json({ data: programs });
}
```

### 5. Checking Single Program Validity

**Validate a specific program:**
```typescript
import { ProgramStatusService } from '@/lib/services/program-status-service';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const programId = 123;
  
  // Check if program is Active
  const isValid = await ProgramStatusService.isProgramValid(supabase, programId);
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'Program is not active' },
      { status: 403 }
    );
  }
  
  // Proceed with operation...
}
```

---

## Migration Guide

### Before (Old Pattern):
```typescript
// Duplicated logic in every API route ❌
const { data: statuses } = await supabase
  .from('program_status')
  .select('program_status_id, status_name');

const excluded = new Set(
  (statuses || [])
    .filter((s: any) =>
      ['cancelled', 'completed', 'quote'].includes(
        (s.status_name || '').toLowerCase()
      )
    )
    .map((s: any) => s.program_status_id)
);

const { data: programs } = await supabase
  .from('member_programs')
  .select('member_program_id');

const validPrograms = (programs || []).filter(
  (p: any) => !excluded.has(p.program_status_id)
);

const programIds = validPrograms.map((p: any) => p.member_program_id);
```

### After (New Pattern):
```typescript
// Single line - centralized logic ✅
const programIds = await ProgramStatusService.getValidProgramIds(supabase, {
  includeStatuses: ['paused']  // If needed
});
```

---

## Decision Tree: Which Method to Use?

```
Do you need program IDs?
├─ Yes → Use getValidProgramIds()
│  ├─ Default (Active only)? → No parameters
│  ├─ Need Paused too? → includeStatuses: ['paused']
│  └─ Need everything? → includeStatuses: ['all']
│
├─ Do you need status IDs?
│  └─ Yes → Use getValidStatusIds()
│
└─ Checking one program?
   └─ Yes → Use isProgramValid()
```

---

## When NOT to Use This Service

- **Audit tables/views** - Should see all programs regardless of status
- **Admin interfaces** - May need to see all programs for management
- **Historical reports** - May need to include completed programs

In these cases, use `includeStatuses: ['all']` or query directly without the service.

---

## Exception Guidelines

**When to request exceptions:**

✅ **DO request exceptions when:**
- Coordinator operations need both Active and Paused programs
- Audit/reporting needs to see all programs
- Sales dashboard needs to see Quote programs
- Specific business requirement documented in ticket

❌ **DON'T request exceptions when:**
- "Just in case" - stick to the default
- Testing - use proper test data instead
- Convenience - if you need an exception, document why

**Always add a comment explaining why an exception is needed:**
```typescript
// Exception: Coordinator operations work on both Active and Paused programs
// because coordinators manage day-to-day activities for programs on hold
const programIds = await ProgramStatusService.getValidProgramIds(supabase, {
  includeStatuses: ['paused']
});
```

