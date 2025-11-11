# Database Change Checklist

**MANDATORY:** Complete this checklist for ANY database schema changes before deployment.

---

## ⚠️ **BEFORE Writing Migration**

### 1. Check Existing Constraints
```sql
-- List all constraints on target table
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint 
WHERE conrelid = 'YOUR_TABLE_NAME'::regclass;
```

**Action:** Copy existing definitions BEFORE modifying

### 2. Check Existing Triggers
```sql
-- List all triggers on target table
SELECT 
  tgname AS trigger_name,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'YOUR_TABLE_NAME'::regclass
  AND tgisinternal = false;
```

**Action:** Verify no triggers reference your changes

### 3. Check Foreign Key Dependencies
```sql
-- Find all tables referencing this table
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name = 'YOUR_TABLE' OR ccu.table_name = 'YOUR_TABLE');
```

### 4. Check Column Usage in Code
```bash
# Search codebase for table/column references
grep -r "table_name\|column_name" src/
```

---

## 📝 **WHILE Writing Migration**

### 1. Use ADD Instead of REPLACE
```sql
-- ❌ BAD: Replaces all existing values
CHECK (status IN ('new_value'))

-- ✅ GOOD: Adds to existing values
-- First, get existing definition, then ADD new value
CHECK (status IN ('existing1', 'existing2', 'new_value'))
```

### 2. Write Rollback Script FIRST
```sql
-- rollback_YYYYMMDD_description.sql
-- If this migration fails or causes issues, run this to undo:

ALTER TABLE table_name DROP CONSTRAINT IF EXISTS new_constraint;
-- ... restore original state
```

### 3. Add Comments
```sql
-- REASON: Adding support for Physical Count feature
-- AFFECTS: inventory_transactions.reference_type
-- EXISTING VALUES: purchase_order, purchase_order_item, program_item, member_program_item_schedule
-- ADDING: count_session
```

---

## 🧪 **TESTING Requirements**

### 1. Test Migration on LOCAL First
```bash
# Run migration
psql -U postgres -d program_tracker < migration.sql

# Verify it worked
psql -U postgres -d program_tracker -c "SELECT ..."
```

### 2. Test EXISTING Functionality
Create a test script for critical workflows:

**`scripts/test-critical-workflows.sql`**
```sql
-- Test 1: Coordinator Redeem (inserts to inventory_transactions)
UPDATE member_program_item_schedule 
SET completed_flag = true 
WHERE member_program_item_schedule_id = 1;

-- Test 2: Purchase Order Receipt
INSERT INTO inventory_transactions (...) VALUES (...);

-- Test 3: Physical Count Post
-- ... etc

-- If any fail, STOP and fix migration
```

### 3. Check for Affected API Routes
```bash
# Find all API routes that write to affected table
grep -r "\.from('table_name').*\(insert\|update\|upsert\)" src/app/api/
```

Test each endpoint manually or with automated tests.

---

## 🚀 **DEPLOYMENT Protocol**

### 1. Staging Environment (REQUIRED for DB changes)
- [ ] Apply migration to staging
- [ ] Run automated tests
- [ ] Manually test critical workflows
- [ ] Let it run for 1 hour, monitor errors
- [ ] Only then proceed to production

### 2. Production Deployment
- [ ] Have rollback script ready
- [ ] Apply migration during low-traffic period
- [ ] Monitor error logs for 15 minutes
- [ ] Test critical workflows immediately
- [ ] Have rollback ready within 5 minutes

### 3. Post-Deployment Verification
```sql
-- Verify constraint is correct
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'your_constraint_name';

-- Check for any errors in last 15 minutes
-- (Check application logs)
```

---

## 🔍 **Review Checklist**

Before merging ANY database migration PR:

- [ ] Existing constraints checked and preserved
- [ ] Existing triggers checked
- [ ] Foreign key dependencies verified
- [ ] Code search for table/column usage completed
- [ ] Rollback script written and tested
- [ ] Migration tested on local database
- [ ] Critical workflows tested after migration
- [ ] All affected API routes identified
- [ ] Staging deployment successful
- [ ] Documentation updated

---

## 🚨 **Red Flags - STOP If You See These**

1. ❌ Dropping any constraint without checking definition first
2. ❌ Modifying CHECK constraint without listing ALL existing values
3. ❌ Adding NOT NULL without default value
4. ❌ Changing column type that might truncate data
5. ❌ Dropping column that might be referenced elsewhere
6. ❌ Any "this should be fine" assumptions

---

## 📚 **Additional Resources**

- Postgres Constraint Docs: https://www.postgresql.org/docs/current/ddl-constraints.html
- Database Migration Best Practices: https://www.prisma.io/dataguide/types/relational/migration-strategies
- Rollback Strategy Guide: https://www.liquibase.com/rollback

---

**Remember:** Database changes are PERMANENT. Take the extra 15 minutes to verify.

**Lesson from Physical Count bug:** Always query existing constraint values BEFORE modifying them.














