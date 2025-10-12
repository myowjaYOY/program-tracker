# Data Integrity Audit Tool

A simple endpoint to verify that all stored financial data matches the calculated values from program items.

## Quick Start

### 1. Basic Audit (Read-Only)
Check all programs without making any changes:

```
GET http://localhost:3000/api/debug/verify-data-integrity
```

**What it checks:**
- ✅ Stored `total_cost` matches sum of item costs
- ✅ Stored `total_charge` matches sum of item charges  
- ✅ Stored `margin` matches calculated margin
- ✅ Stored `taxes` matches calculated taxes
- ✅ Stored `variance` is correct (for Active programs)
- ✅ Active programs have `contracted_at_margin` set

### 2. Check Specific Program
Audit just one program:

```
GET http://localhost:3000/api/debug/verify-data-integrity?programId=2
```

### 3. Auto-Fix Mode
Automatically fix any discrepancies found:

```
GET http://localhost:3000/api/debug/verify-data-integrity?autoFix=true
```

⚠️ **Use with caution!** This will update the database.

---

## Response Format

### Summary
```json
{
  "summary": {
    "totalPrograms": 6,
    "programsWithIssues": 1,
    "programsWithWarnings": 0,
    "totalIssues": 2,
    "totalFixed": 0,
    "autoFixEnabled": false
  },
  "results": [...]
}
```

### Individual Program Results
```json
{
  "programId": 2,
  "programName": "Program 2",
  "status": "Active",
  "issues": [
    "margin mismatch: stored 57.00% vs calculated 58.25% (diff: 1.25%)"
  ],
  "warnings": [],
  "passed": false,
  "storedValues": {
    "cost": 1505.30,
    "charge": 3342.40,
    "margin": 57.00,
    "taxes": 275.20,
    "variance": 0
  },
  "calculatedValues": {
    "cost": 1435.35,
    "charge": 3342.40
  }
}
```

---

## Understanding Issues vs Warnings

### Issues (Red Flags 🚨)
These indicate data integrity problems that should be fixed:
- Cost/charge mismatch > $0.01
- Margin mismatch > 0.1%
- Missing `contracted_at_margin` for Active programs

### Warnings (Yellow Flags ⚠️)
These are minor discrepancies or informational:
- Small tax calculation differences (rounding)
- Small variance discrepancies (< $0.01)
- Missing finances record (for new programs)

---

## When to Run This Audit

### Recommended Schedule
- **After major changes:** Run after implementing new financial logic
- **Weekly:** Quick spot check on all programs
- **Before month-end:** Ensure all financials are accurate for reporting

### After Specific Actions
- ✅ After bulk data imports
- ✅ After modifying financial calculation logic
- ✅ After transitioning programs to Active status
- ✅ After discovering any UI display issues

---

## Common Issues and Fixes

### Issue: "total_cost mismatch"
**Cause:** The `updateMemberProgramCalculatedFields()` function didn't run or failed silently.

**Fix:** Run with `autoFix=true` or manually update via the program's Items tab (add/remove an item).

---

### Issue: "margin mismatch"
**Cause:** Margin calculation formula changed, or margin wasn't recalculated after item changes.

**Fix:** Run with `autoFix=true`. For Active programs, this will use the correct locked-price formula.

---

### Issue: "Active program missing contracted_at_margin"
**Cause:** Program was transitioned to Active before the database trigger was in place.

**Fix:** Run `/api/debug/sync-contracted-margins` (one-time migration).

---

## Using in Production

### Option 1: Manual Check
- Open in browser: `https://your-domain.com/api/debug/verify-data-integrity`
- Review the JSON response
- If issues found, run with `autoFix=true`

### Option 2: Scheduled Job
Create a simple cron job or scheduled task:

```bash
# Check every Sunday at 2 AM
0 2 * * 0 curl https://your-domain.com/api/debug/verify-data-integrity
```

### Option 3: Admin Dashboard Button
Add a button to your admin page:

```tsx
const handleAudit = async () => {
  const response = await fetch('/api/debug/verify-data-integrity');
  const data = await response.json();
  console.log(data);
  alert(`Checked ${data.summary.totalPrograms} programs. Found ${data.summary.totalIssues} issues.`);
};

<Button onClick={handleAudit}>Run Data Audit</Button>
```

---

## Security Note

This endpoint requires authentication. Only logged-in users can access it.

For production, consider:
- Adding admin-only permission check
- Rate limiting to prevent abuse
- Logging audit runs for compliance

---

## Related Endpoints

- `/api/debug/audit-margins` - Old margin audit (read-only)
- `/api/debug/fix-margins` - Old margin fix (deprecated, use verify-data-integrity with autoFix)
- `/api/debug/sync-contracted-margins` - One-time migration for contracted_at_margin
- `/api/debug/investigate-program/[id]` - Detailed diagnostic for one program

---

## Example Usage in Browser Console

```javascript
// Quick check all programs
fetch('/api/debug/verify-data-integrity')
  .then(r => r.json())
  .then(data => {
    console.table(data.results.map(r => ({
      Program: r.programName,
      Status: r.status,
      Issues: r.issues.length,
      Passed: r.passed ? '✅' : '❌'
    })));
  });

// Auto-fix all issues
fetch('/api/debug/verify-data-integrity?autoFix=true')
  .then(r => r.json())
  .then(data => {
    console.log(`Fixed ${data.summary.totalFixed} programs`);
  });
```

---

## Changelog

### 2025-01-10
- Initial release
- Checks: cost, charge, margin, taxes, variance
- Auto-fix capability
- Support for Active program locked-price logic

