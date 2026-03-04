# Multi-Tenancy Design Document

**Document Version:** 1.0  
**Date:** February 5, 2026  
**Status:** Draft - For Discussion  
**Author:** [Your Name]

---

## Executive Summary

This document outlines the proposed approach to convert the Program Tracker application from a single-tenant system to a multi-tenant SaaS platform. The goal is to enable multiple organizations (tenants) to use the same application while keeping their data completely isolated.

**Key Design Decisions:**
- Use a shared database schema with Row Level Security (RLS) for tenant isolation
- Minimize frontend code changes by handling isolation at the database layer
- Ensure HIPAA compliance through additional safeguards

---

## 1. Requirements

### Functional Requirements
- Multiple organizations can use the application independently
- Each tenant sees only their own data
- New tenants can be onboarded without code deployment
- Existing functionality remains unchanged

### Non-Functional Requirements
- Minimize changes to the frontend/UI layer
- Tenant isolation must be enforced at the database level
- Solution must support HIPAA compliance requirements
- Reasonable cost at scale (dozens of tenants initially)

### Constraints
- Must work with Supabase (current infrastructure)
- Cannot require significant frontend refactoring
- Must support existing data migration

---

## 2. Recommended Approach: Shared Schema with Row Level Security

### Overview

All tenants share the same database tables. Each table containing tenant-specific data gets a `tenant_id` column. PostgreSQL Row Level Security (RLS) policies automatically filter queries so users only see their own tenant's data.

### How It Works

1. A new `tenants` table stores tenant information (name, settings, subscription tier)
2. The `users` table gets a `tenant_id` column linking each user to their tenant
3. All data tables (leads, programs, therapies, etc.) get a `tenant_id` column
4. RLS policies on each table filter rows where `tenant_id` matches the current user's tenant
5. A database trigger automatically sets `tenant_id` on new records

### Why This Approach

| Benefit | Explanation |
|---------|-------------|
| Minimal frontend changes | RLS is transparent to application code; existing queries work unchanged |
| Automatic isolation | Database enforces tenant boundaries; cannot be bypassed by application bugs |
| Single codebase | One deployment serves all tenants |
| Cost-effective | One database instance for all tenants |
| Supabase native | RLS is a core Supabase feature with good tooling support |

---

## 3. Alternative Approaches Considered

### Option A: Schema-Per-Tenant

Each tenant gets their own PostgreSQL schema within the same database.

| Pros | Cons |
|------|------|
| Complete logical isolation | Supabase doesn't support this pattern well |
| Per-tenant schema customization | Schema changes must run on every tenant |
| Easy tenant deletion | Requires custom connection management |

**Verdict:** Not recommended due to poor Supabase support.

### Option B: Database-Per-Tenant

Each tenant gets their own Supabase project/database.

| Pros | Cons |
|------|------|
| Complete physical isolation | Expensive ($25+/month per tenant minimum) |
| Best for compliance | Operational complexity (managing many projects) |
| Independent scaling | Schema migrations must run on every database |
| No RLS complexity | Frontend must route to correct database |

**Verdict:** Consider for enterprise/compliance-required customers as a premium tier. Not recommended as default approach.

### Option C: Hybrid

Small tenants share a database (RLS-based); enterprise tenants get dedicated databases.

| Pros | Cons |
|------|------|
| Cost-effective for small tenants | Two systems to maintain |
| Premium option for enterprise | Complex testing requirements |
| Compliance flexibility | Migration path from shared to dedicated |

**Verdict:** Good future evolution, but adds complexity. Start with shared schema, add dedicated option later if needed.

---

## 4. Design Overview

### 4.1 New Database Objects

| Object | Purpose |
|--------|---------|
| `tenants` table | Registry of all tenants with name, settings, subscription info |
| `get_current_tenant_id()` function | Helper to retrieve current user's tenant from session |
| `set_tenant_id()` trigger function | Automatically sets tenant_id on new records |

### 4.2 Tables Requiring Modification

**Core Data Tables (44 tables)** - Must add `tenant_id` column:

| Category | Tables |
|----------|--------|
| CRM/Sales | leads, lead_notes, lead_status_transitions, campaigns |
| Member Programs | member_programs, member_program_items, member_program_item_schedule, member_program_item_tasks, member_program_items_task_schedule, member_program_payments, member_program_finances, member_program_membership_finances, member_program_rasha |
| Templates | program_template, program_template_items, program_template_rasha |
| Therapy Catalog | therapies, therapy_tasks, therapies_bodies_pillars |
| Inventory | inventory_items, inventory_transactions, inventory_count_sessions, inventory_count_details, purchase_orders, purchase_order_items, item_requests |
| Surveys/Analytics | survey_response_sessions, survey_responses, survey_domain_scores, survey_user_mappings, survey_user_progress, member_analytics_cache, member_individual_insights, member_progress_summary |
| System | users, user_menu_permissions, notifications, audit_events, audit_event_changes, data_import_jobs, data_import_errors, cron_job_runs, vendors |
| Reference (tenant-specific) | status, program_roles, financing_types, buckets, therapytype, rasha_list |

**Global Reference Tables (no tenant_id)** - Shared across all tenants:

| Tables | Reasoning |
|--------|-----------|
| program_status | Standard lifecycle states (Quote, Active, Paused, etc.) |
| payment_status | Standard payment states (Pending, Paid, Late) |
| payment_methods | Standard payment types (Cash, Check, Credit Card) |
| bodies, pillars | Standardized health classifications |
| survey_forms, survey_questions, survey_domains | Standardized assessments (MSQ-95, PROMIS-29) |
| menu_items | Application navigation (same for all) |

### 4.3 RLS Policy Pattern

Each tenant-specific table will have four RLS policies:

| Policy | Purpose |
|--------|---------|
| SELECT | Users can only read rows matching their tenant_id |
| INSERT | Users can only insert rows into their tenant |
| UPDATE | Users can only update rows matching their tenant_id |
| DELETE | Users can only delete rows matching their tenant_id |

### 4.4 Frontend Changes (Minimal)

| Change | Description |
|--------|-------------|
| Tenant identification | Middleware to identify tenant from subdomain or login |
| No query changes | Existing queries work unchanged; RLS filters automatically |
| No insert changes | Trigger automatically sets tenant_id on new records |

---

## 5. HIPAA Compliance Considerations

### Regulatory Context

HIPAA does not mandate specific technologies or architectures. The Security Rule (45 CFR §164.312) requires "reasonable and appropriate" safeguards based on risk analysis.

### Shared Schema + RLS: Compliance Assessment

| HIPAA Requirement | How RLS Addresses It | Additional Safeguards Needed |
|-------------------|----------------------|------------------------------|
| Access Control §164.312(a) | RLS policies restrict access by tenant | Automated verification that all tables have RLS |
| Audit Controls §164.312(b) | Audit tables track changes | Ensure audit tables are also tenant-isolated |
| Integrity §164.312(c) | RLS prevents unauthorized modification | Document risk of shared infrastructure |
| Authentication §164.312(d) | Supabase Auth | Already compliant |
| Transmission §164.312(e) | TLS encryption | Already compliant |

### Key Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing RLS policy on new table | All tenants see that table's data | Automated CI/CD check that verifies RLS on all tables |
| Bug in tenant identification function | Wrong tenant sees data | Automated tenant isolation test suite |
| Service role key exposed | Full database access | Never use service role in client-facing code |
| Single database failure | All tenants affected | Standard backup/recovery procedures |

### Mandatory Requirements for HIPAA Compliance

1. **Business Associate Agreement (BAA)** with Supabase (requires Pro plan or above)
2. **Automated RLS verification** in CI/CD pipeline
3. **Tenant isolation test suite** covering all PHI tables
4. **Audit logging** for all PHI access
5. **Documented risk analysis** for compliance audits
6. **Incident response procedures** for potential breaches

### When Physical Separation May Be Required

Some customers may contractually require dedicated databases regardless of HIPAA flexibility:
- Large healthcare systems with specific security policies
- Government healthcare (FedRAMP requirements)
- International customers with data residency requirements (GDPR)
- Customers who require independent penetration testing

**Recommendation:** Offer database-per-tenant as a premium "Enterprise" tier for these customers.

---

## 6. Implementation Approach

### Phase 1: Preparation (No Downtime)
- Create tenants table
- Create helper functions
- Add tenant_id columns as NULLABLE to all tables
- Create indexes on tenant_id columns

### Phase 2: Data Migration (No Downtime)
- Create initial tenant record for existing data
- Backfill tenant_id on all existing records
- Verify data integrity

### Phase 3: Enforcement (Brief Maintenance Window)
- Make tenant_id columns NOT NULL
- Enable RLS on all tables
- Create RLS policies
- Create auto-set triggers
- Deploy frontend changes

### Phase 4: Validation
- Run tenant isolation test suite
- Verify existing functionality
- Monitor for issues

---

## 7. Risks and Trade-offs

### Advantages of This Approach

| Advantage | Business Impact |
|-----------|-----------------|
| Minimal frontend changes | Faster implementation, lower risk |
| Automatic isolation | Reduces security bugs |
| Single deployment | Simpler operations |
| Cost-effective | Lower infrastructure costs |
| Future flexibility | Can add dedicated databases for enterprise later |

### Disadvantages and Limitations

| Limitation | Business Impact |
|------------|-----------------|
| Shared infrastructure | One tenant's heavy usage can affect others |
| No per-tenant customization | All tenants have same schema/fields |
| Cross-tenant reporting complex | Admin analytics require bypassing RLS |
| Backup contains all tenants | Cannot restore single tenant easily |
| RLS overhead | Small performance impact on queries |

### Performance Considerations

- Adding tenant_id to queries adds minimal overhead with proper indexing
- Tables with millions of rows may benefit from partitioning by tenant_id
- Connection pooling is shared across tenants

---

## 8. Open Questions for Discussion

1. **Tenant identification method:**
   - Subdomain-based (acme.yourapp.com)?
   - Login-based (user selects tenant)?
   - Both?

2. **Reference data strategy:**
   - Which reference tables should tenants be able to customize?
   - Should tenants be able to add custom statuses, therapy types, etc.?

3. **Super admin access:**
   - How should platform administrators access tenant data for support?
   - What audit trail is needed for admin access?

4. **Tenant onboarding:**
   - Self-service signup or manual provisioning?
   - Default data seeding for new tenants?

5. **Enterprise tier:**
   - Should we plan for database-per-tenant as premium option?
   - What price premium would justify the additional complexity?

6. **Existing data:**
   - How should current production data be handled?
   - Create "Tenant Zero" for existing customer?

---

## 9. Next Steps

1. Review this document and discuss open questions
2. Finalize decisions on reference data and tenant identification
3. Create detailed migration plan with specific SQL scripts
4. Set up development environment for testing
5. Implement Phase 1 (preparation) in development
6. Create tenant isolation test suite
7. Plan production migration timeline

---

## Appendix A: Affected Schema Objects Summary

| Category | Count | Action |
|----------|-------|--------|
| New tables | 1 | Create `tenants` table |
| New functions | 2-3 | Tenant helper functions |
| Tables needing tenant_id | ~44 | Add column, index, RLS policies, trigger |
| Global reference tables | ~12 | No changes needed |
| RLS policies to create | ~180 | 4 policies per tenant-specific table |
| Triggers to create | ~44 | Auto-set tenant_id on insert |

---

## Appendix B: Reference Documents

- Current database schema: `database/SCHEMA.md`
- HIPAA Security Rule: 45 CFR Part 164, Subpart C
- Supabase RLS documentation: https://supabase.com/docs/guides/auth/row-level-security

---

*This document is intended for internal discussion. Implementation details and specific SQL scripts will be developed after design approval.*
