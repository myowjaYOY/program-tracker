# Production Safety Protocol

**Purpose:** Prevent breaking production with database changes  
**Created:** November 4, 2025  
**Reason:** Physical Count feature broke Coordinator redeem functionality

---

## 🎯 **Core Principle**

> **"Assume Nothing. Verify Everything. Test Twice."**

---

## 📋 **Quick Reference**

### For Database Changes:
1. ✅ Use **`docs/DATABASE-CHANGE-CHECKLIST.md`** (MANDATORY)
2. ✅ Run **`scripts/check-constraint-before-modify.sql`** BEFORE writing migration
3. ✅ Write **rollback script FIRST**
4. ✅ Test on **local**, then **staging**, then **production**
5. ✅ Run **`scripts/test-critical-workflows.md`** after deployment

### For Code Changes:
1. ✅ Check if any database tables are affected
2. ✅ If yes, follow database protocol above
3. ✅ Run linter: `npm run lint`
4. ✅ Test locally before pushing
5. ✅ Monitor production logs after deployment

---

## 🚨 **What Went Wrong (Case Study)**

### The Physical Count Bug

**What I did:**
```sql
-- Updated constraint, but didn't check existing values
ALTER TABLE inventory_transactions ADD CONSTRAINT 
  CHECK (reference_type IN (
    'purchase_order', 
    'purchase_order_item', 
    'program_item', 
    'count_session',  -- Added this
    -- ❌ FORGOT 'member_program_item_schedule'!
    'manual_adjustment', 
    'return'
  ));
```

**What broke:**
- Coordinator redeem/miss functionality (500 error)
- Trigger that inserts `member_program_item_schedule` transactions failed
- Users couldn't mark schedule items as completed

**Why it broke:**
1. Didn't query existing constraint values
2. Assumed I knew all the values
3. Didn't test coordinator functionality after migration
4. Deployed database change without verifying impact

**How it was caught:**
- User reported 500 error
- Console showed constraint violation
- 2 hours of broken production

---

## ✅ **Prevention System**

### 1. Documentation
- **`DATABASE-CHANGE-CHECKLIST.md`** - Step-by-step guide
- **`PRODUCTION-SAFETY-PROTOCOL.md`** - This file
- **`test-critical-workflows.md`** - Manual test suite

### 2. Helper Scripts
- **`check-constraint-before-modify.sql`** - Query existing definitions
- **`test-critical-workflows.md`** - Test critical paths

### 3. PR Templates
- **`.github/PULL_REQUEST_TEMPLATE/database_migration.md`** - Enforces checklist

### 4. Process
1. **Before:** Check existing state
2. **During:** Write with safety in mind
3. **After:** Test everything

---

## 🔧 **Required Tools Setup**

### 1. Local Database
```bash
# Ensure you have a local copy of production schema
# (WITHOUT production data for privacy)
psql -U postgres -d program_tracker_dev
```

### 2. Staging Environment
**Recommended:** Set up a staging Supabase project
- Clone production schema
- Use test data
- Deploy migrations here first

### 3. Error Monitoring
- Monitor Supabase logs after deployment
- Watch for 500 errors
- Set up alerts for critical endpoints

---

## 📊 **Deployment Safety Levels**

### Level 1: Code-Only Changes ✅
**Risk:** Low  
**Requirements:**
- [ ] Linter passes
- [ ] Local testing
- [ ] No database changes

**Deploy:** Anytime

---

### Level 2: Database + Code (Additive) ⚠️
**Risk:** Medium  
**Requirements:**
- [ ] Complete database checklist
- [ ] Adding columns/tables only
- [ ] No constraint modifications
- [ ] Rollback script ready
- [ ] Test critical workflows

**Deploy:** During low-traffic periods

---

### Level 3: Database + Code (Modifications) 🚨
**Risk:** HIGH  
**Requirements:**
- [ ] Complete database checklist
- [ ] Staging deployment successful
- [ ] Critical workflows tested
- [ ] Rollback script tested
- [ ] Team notified
- [ ] Monitor for 1 hour post-deployment

**Deploy:** During scheduled maintenance window

---

## 🎯 **Critical Workflows (Must Test)**

After ANY database change, test these:

1. **Coordinator Script** - Redeem/miss items
2. **Purchase Orders** - Receive items
3. **Program Financials** - Update values
4. **Therapy Management** - Create/edit therapies
5. **Program Status** - Change status, verify readonly

**Time:** 10 minutes  
**When:** After EVERY database deployment

---

## 🔄 **Rollback Procedure**

### If Something Breaks:

1. **Immediate:**
   ```sql
   -- Run your rollback script
   psql -U postgres -d database < rollback_YYYYMMDD_description.sql
   ```

2. **Verify:**
   ```sql
   -- Check constraint is restored
   SELECT pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conname = 'constraint_name';
   ```

3. **Test:**
   - Verify broken functionality works again
   - Check error logs cleared

4. **Communicate:**
   - Notify team
   - Document what happened
   - Create hotfix report

---

## 📈 **Success Metrics**

### Goals:
- ✅ Zero production breaks from database changes
- ✅ All migrations have rollback scripts
- ✅ 100% of database PRs use checklist
- ✅ Staging tested before production

### How to Track:
- Count production incidents per month
- Review database change PRs weekly
- Audit rollback script completeness

---

## 🎓 **Training**

### For Team Members:

**Before making database changes:**
1. Read `DATABASE-CHANGE-CHECKLIST.md`
2. Review this document
3. Practice on local database
4. Pair with experienced developer for first migration

**Resources:**
- Postgres Documentation: https://www.postgresql.org/docs/
- Supabase Migration Guide: https://supabase.com/docs/guides/database/migrations
- This repo's docs/ folder

---

## 📞 **Emergency Contacts**

If production breaks:
1. Check `docs/HOTFIX-*.md` for similar issues
2. Review error logs in Supabase dashboard
3. Run rollback script if available
4. Document incident in `docs/HOTFIX-YYYYMMDD-description.md`

---

## 📝 **Incident Template**

When something breaks, create:
**`docs/HOTFIX-YYYYMMDD-description.md`**

Include:
- What broke
- Root cause
- Fix applied
- How to prevent next time
- Lessons learned

---

## 🚀 **Future Improvements**

### Recommended:
1. **Staging Environment** - Separate Supabase project for testing
2. **Automated Tests** - E2E tests for critical workflows
3. **CI/CD Pipeline** - Auto-run checks before merge
4. **Database Diff Tool** - Compare schema changes
5. **Migration Review** - Require 2+ approvals for DB changes

### Nice to Have:
- Pre-commit hooks for database changes
- Automated rollback on error detection
- Schema versioning system
- Migration dry-run mode

---

## ✅ **Action Items for Team**

**Immediate (This Week):**
- [ ] Review this protocol with team
- [ ] Bookmark `DATABASE-CHANGE-CHECKLIST.md`
- [ ] Set up local development database
- [ ] Practice running `check-constraint-before-modify.sql`

**Short Term (This Month):**
- [ ] Set up staging environment
- [ ] Create automated test suite
- [ ] Implement PR review requirement for DB changes

**Long Term (This Quarter):**
- [ ] CI/CD pipeline with automated checks
- [ ] E2E test coverage for critical paths
- [ ] Database change approval workflow

---

## 📚 **Related Documents**

- `DATABASE-CHANGE-CHECKLIST.md` - Detailed checklist
- `check-constraint-before-modify.sql` - Helper script
- `test-critical-workflows.md` - Test procedures
- `HOTFIX-coordinator-redeem-bug.md` - Example incident report
- `.github/PULL_REQUEST_TEMPLATE/database_migration.md` - PR template

---

**Remember:** Taking 15 extra minutes to verify changes is always faster than fixing production at 2am.

**Last Updated:** November 4, 2025  
**Next Review:** December 1, 2025






