## 🗄️ Database Migration PR

**Migration Name:** `YYYYMMDD_description.sql`

---

## 📝 Description

<!-- Describe what this migration does and why it's needed -->

---

## ⚠️ **MANDATORY CHECKLIST** (Must complete ALL items)

### Pre-Migration Investigation
- [ ] Ran `scripts/check-constraint-before-modify.sql` on target table(s)
- [ ] Documented existing constraint definitions in this PR
- [ ] Searched codebase for table/column references: `grep -r "table_name" src/`
- [ ] Checked for affected API routes
- [ ] Identified existing triggers on target table(s)

### Migration Quality
- [ ] Migration includes comments explaining the change
- [ ] Used ADD instead of REPLACE for constraint values
- [ ] Preserved ALL existing constraint values
- [ ] No columns dropped without verification
- [ ] No NOT NULL added without default value

### Safety Measures
- [ ] Created rollback script: `rollback_YYYYMMDD_description.sql`
- [ ] Tested rollback script locally
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] Includes `IF EXISTS` / `IF NOT EXISTS` checks

### Testing
- [ ] Applied migration on local database
- [ ] Ran critical workflow tests (see `scripts/test-critical-workflows.md`)
- [ ] All affected API routes tested manually
- [ ] No errors in local console/logs
- [ ] Staging environment deployment successful (if applicable)

### Documentation
- [ ] Updated `docs/database-schema.md` (if applicable)
- [ ] Added migration notes to PR description
- [ ] Documented any data migrations or backfills

---

## 🔍 Investigation Results

### Existing Constraints Found
```sql
-- Paste output from check-constraint-before-modify.sql here
-- This proves you checked before modifying!
```

### Affected API Routes
<!-- List all API routes that write to the affected table(s) -->
- `/api/...`
- `/api/...`

### Critical Workflows Tested
- [ ] Coordinator Script - Redeem/Miss
- [ ] Purchase Order Receipt
- [ ] Program Financial Updates
- [ ] Therapy Creation
- [ ] [Other - specify]

---

## 📋 Rollback Script

```sql
-- Paste your rollback script here
-- Reviewers should verify this will undo the migration
```

---

## 🚨 Breaking Changes?

**Does this migration break existing functionality?**
- [ ] No, fully backward compatible
- [ ] Yes (explain below and get explicit approval)

<!-- If yes, explain what breaks and the migration plan -->

---

## 🎯 Deployment Plan

**When to deploy:**
- [ ] During low-traffic period (evening/weekend)
- [ ] Requires downtime (coordinate with team)
- [ ] Can deploy anytime

**Post-deployment monitoring:**
- [ ] Will monitor error logs for 1 hour after deployment
- [ ] Will test critical workflows immediately after deployment
- [ ] Will be available for rollback if needed

---

## 👀 Reviewer Checklist

**For PR reviewers:**
- [ ] Verified existing constraints are preserved
- [ ] Rollback script looks correct
- [ ] Testing checklist is complete
- [ ] No red flags in migration code
- [ ] Approved for merge

---

## 📚 Related

- Issue: #
- Documentation: docs/...
- Related PRs: #

---

**⚠️ Remember:** Database changes are PERMANENT. Triple-check everything!




















