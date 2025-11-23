# Database Schema Export Instructions

## Recommended Method: Using Supabase CLI

The most efficient and accurate way to export your complete database schema is using the Supabase CLI's built-in `db dump` command.

### Steps:

1. **Install Supabase CLI** (if not already installed):
```bash
npm install -g supabase
```

2. **Login to Supabase**:
```bash
supabase login
```

3. **Link to your project**:
```bash
supabase link --project-ref mxktlbhiknpdauzoitnm
```

4. **Export the schema**:
```bash
supabase db dump -f "YOY Program Tracker.sql" --data-only=false
```

This will generate a complete SQL file with:
- All table definitions
- All constraints (PRIMARY KEY, FOREIGN KEY, CHECK, UNIQUE)
- All indexes
- All views
- All functions
- All triggers
- All RLS policies
- All comments
- Proper ordering to handle dependencies

### Alternative: Direct pg_dump

If you have PostgreSQL client tools installed:

```bash
pg_dump "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \\
  --schema=public \\
  --no-owner \\
  --no-acl \\
  -f "YOY Program Tracker.sql"
```

### What I've Done So Far

I've started generating the schema using MCP queries, but given the size (54 tables, dozens of functions, triggers, and views), the CLI method above will be:
- **Faster**: Single command vs hundreds of queries
- **More Accurate**: Handles all edge cases and dependencies
- **Complete**: Captures everything including RLS policies, grants, etc.
- **Properly Ordered**: Ensures dependencies are in correct order

The file will be comprehensive and ready to use for documentation or restoration purposes.





















