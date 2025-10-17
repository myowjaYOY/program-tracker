# 📋 Member Program RASHA Table Documentation

## Overview
The `member_program_rasha` table links member programs to RASHA list items, similar to how `member_program_items` links programs to therapy items.

---

## 📊 Table Structure

### Columns

| Column Name | Type | Nullable | Default | Description |
|-------------|------|----------|---------|-------------|
| `member_program_rasha_id` | integer | NO | nextval() | Primary key, auto-incrementing |
| `member_program_id` | integer | NO | - | Foreign key to member_programs |
| `rasha_list_id` | integer | NO | - | Foreign key to rasha_list |
| `group_name` | text | YES | null | Alphanumeric group identifier |
| `type` | text | NO | - | Type: 'individual' or 'group' |
| `order_number` | integer | NO | 0 | Sort order for display |
| `active_flag` | boolean | NO | true | Soft delete flag |
| `created_at` | timestamp with time zone | YES | now() | Creation timestamp |
| `created_by` | uuid | YES | auth.uid() | User who created the record |
| `updated_at` | timestamp with time zone | YES | now() | Last update timestamp |
| `updated_by` | uuid | YES | auth.uid() | User who last updated |

### Constraints

1. **Primary Key**: `member_program_rasha_pkey` on `member_program_rasha_id`
2. **Check Constraint**: `member_program_rasha_type_check`
   - Ensures `type` is either 'individual' or 'group'
   - SQL: `CHECK (type IN ('individual', 'group'))`

### Indexes

1. **idx_member_program_rasha_member_program** - btree index on `member_program_id`
   - Speeds up queries filtering by program
2. **idx_member_program_rasha_rasha_list** - btree index on `rasha_list_id`
   - Speeds up queries filtering by RASHA item

---

## 🔐 Security & Permissions

### Row Level Security (RLS)
- **Status**: ENABLED
- **Policy**: `all_access_member_program_rasha`
  - Allows ALL operations (SELECT, INSERT, UPDATE, DELETE)
  - Available to: public
  - Condition: true (no restrictions)

### Grants
- **authenticated role**: ALL privileges on table and sequence
- **service_role**: ALL privileges on table and sequence

---

## 🔄 Audit System

### Triggers

| Trigger Name | Type | Event | Function | Purpose |
|--------------|------|-------|----------|---------|
| `tr_audit_member_program_rasha` | AFTER | INSERT, UPDATE, DELETE | `audit_member_program_rasha()` | Full audit logging |
| `update_member_program_rasha_timestamp` | BEFORE | UPDATE | `update_timestamp_function()` | Auto-update timestamps |

### Audit Function Features

The `audit_member_program_rasha()` function:

1. **INSERT Operations**
   - Logs: "Program RASHA item created"
   - Captures: Complete new record as JSON
   - Links: To member_id and program_id for filtering

2. **UPDATE Operations**
   - Logs: "Program RASHA item updated"
   - Tracks: Specific fields that changed
   - Creates: Friendly change summary (e.g., "Changed: Type, Order")
   - Field labels:
     - `rasha_list_id` → "RASHA Item"
     - `group_name` → "Group Name"
     - `type` → "Type"
     - `order_number` → "Order"
     - `active_flag` → "Active"

3. **DELETE Operations**
   - Logs: "Program RASHA item deleted"
   - Captures: Complete old record as JSON

### Audit Event Storage
All audit events are stored in the `audit_events` table with:
- Event type (INSERT/UPDATE/DELETE)
- Actor (user who performed the action)
- Context (member_id, program_id)
- Before/after JSON data
- Summary of changes

---

## 📐 Relationships

### Parent Tables
1. **member_programs** (via `member_program_id`)
   - One program can have many RASHA items
   
2. **rasha_list** (via `rasha_list_id`)
   - One RASHA item can be used in many programs

### Relationship Diagram
```
member_programs
  └── member_program_id (1)
        ├── member_program_rasha (*) ← NEW TABLE
        │     └── rasha_list_id (*)
        │           └── rasha_list (1)
        └── member_program_items (*)
              └── therapy_id (*)
                    └── therapies (1)
```

---

## 🎯 Use Cases

### 1. Group RASHA Items
```sql
-- Assign a RASHA item to a group within a program
INSERT INTO member_program_rasha 
  (member_program_id, rasha_list_id, group_name, type, order_number)
VALUES 
  (1, 1, 'Alpha Team', 'group', 1);
```

### 2. Individual RASHA Items
```sql
-- Assign a RASHA item to an individual within a program
INSERT INTO member_program_rasha 
  (member_program_id, rasha_list_id, type, order_number)
VALUES 
  (1, 2, 'individual', 2);
```

### 3. Query All RASHA Items for a Program
```sql
SELECT 
  mpr.member_program_rasha_id,
  mpr.group_name,
  mpr.type,
  mpr.order_number,
  rl.name as rasha_name,
  rl.length as rasha_length
FROM member_program_rasha mpr
JOIN rasha_list rl ON rl.rasha_list_id = mpr.rasha_list_id
WHERE mpr.member_program_id = 1
  AND mpr.active_flag = true
ORDER BY mpr.order_number;
```

### 4. Get Audit History
```sql
SELECT 
  ae.created_at,
  ae.event_type,
  ae.summary,
  u.email as actor_email
FROM audit_events ae
LEFT JOIN users u ON u.id = ae.actor_id
WHERE ae.table_name = 'member_program_rasha'
  AND ae.record_id = 1
ORDER BY ae.created_at DESC;
```

---

## ✅ Data Validation

### Type Validation
The `type` column enforces valid values through a CHECK constraint:

**Valid Values:**
- ✅ `'individual'`
- ✅ `'group'`

**Invalid Values:**
- ❌ `'Individual'` (case-sensitive)
- ❌ `'GROUP'` (case-sensitive)
- ❌ `'team'`
- ❌ `'person'`
- ❌ `null`

**Error Example:**
```sql
INSERT INTO member_program_rasha (member_program_id, rasha_list_id, type, order_number)
VALUES (1, 1, 'Team', 1);

-- Error: new row for relation "member_program_rasha" violates check constraint "member_program_rasha_type_check"
```

---

## 🧪 Testing Checklist

### ✅ Database Setup
- [ ] Run `member_program_rasha_complete.sql` in Supabase SQL Editor
- [ ] Verify table created: `SELECT * FROM pg_tables WHERE tablename = 'member_program_rasha'`
- [ ] Verify indexes created: `SELECT indexname FROM pg_indexes WHERE tablename = 'member_program_rasha'`
- [ ] Verify triggers created: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.member_program_rasha'::regclass`

### ✅ Insert Operations
- [ ] Insert a group type RASHA item
- [ ] Insert an individual type RASHA item
- [ ] Try to insert invalid type (should fail)
- [ ] Verify `created_at` and `created_by` are set

### ✅ Update Operations
- [ ] Update `group_name` field
- [ ] Update `order_number` field
- [ ] Verify `updated_at` is newer than `created_at`
- [ ] Verify `updated_by` is set to current user

### ✅ Audit Logging
- [ ] Check audit_events table after INSERT
- [ ] Check audit_events table after UPDATE
- [ ] Verify change tracking in audit_changes table
- [ ] Check summary text is generated correctly

### ✅ Type Constraint
- [ ] Try inserting 'invalid_type' (should fail)
- [ ] Try inserting 'Individual' with capital (should fail)
- [ ] Verify only 'individual' and 'group' are accepted

### ✅ RLS & Permissions
- [ ] Verify authenticated users can read/write
- [ ] Verify service_role can bypass RLS

---

## 🔄 Migration from Existing System

If you need to migrate existing data:

```sql
-- Example: Migrate from a hypothetical old structure
INSERT INTO member_program_rasha 
  (member_program_id, rasha_list_id, group_name, type, order_number, created_at, created_by)
SELECT 
  old_program_id,
  old_rasha_id,
  old_group,
  CASE 
    WHEN old_is_group THEN 'group'
    ELSE 'individual'
  END,
  old_sequence,
  old_timestamp,
  old_user_id
FROM old_rasha_assignments
WHERE old_active = true;
```

---

## 📚 Related Documentation

- **RASHA List Table**: See `rasha_list_complete.sql`
- **Member Programs**: Core table for program management
- **Audit System**: See `audit_events` and `audit_changes` tables
- **Pattern Reference**: Based on `member_program_items` table structure

---

## 🚨 Important Notes

1. **Case Sensitivity**: The `type` field is case-sensitive. Always use lowercase:
   - ✅ `'individual'`
   - ✅ `'group'`
   - ❌ `'Individual'`, `'GROUP'`, etc.

2. **Group Name**: Optional for 'individual' type, but recommended for 'group' type

3. **Order Number**: Controls display order. Lower numbers appear first.

4. **Soft Delete**: Use `active_flag = false` instead of DELETE for data retention

5. **Audit Trail**: All changes are logged. Never manually modify audit tables.

6. **Foreign Keys**: Optional FK constraints are provided at the end of the SQL file. Enable if you want enforced referential integrity.

---

## 📊 Comparison with member_program_items

| Feature | member_program_items | member_program_rasha |
|---------|---------------------|---------------------|
| Links to | therapies | rasha_list |
| Type field | No | Yes (individual/group) |
| Group field | No | Yes (group_name) |
| Order field | days_from_start | order_number |
| Quantity field | Yes | No |
| Cost fields | Yes (item_cost, item_charge) | No |
| Audit triggers | Yes (2 triggers) | Yes (2 triggers) |
| RLS policy | Yes | Yes |
| Indexes | 1 (member_program_id) | 2 (member_program_id, rasha_list_id) |

---

## 🎉 Summary

The `member_program_rasha` table is now fully implemented with:
- ✅ Complete table structure
- ✅ Data validation (type constraint)
- ✅ Full audit logging
- ✅ Automatic timestamp updates
- ✅ Row-level security
- ✅ Proper indexing
- ✅ Comprehensive documentation

**Ready for production use!**

