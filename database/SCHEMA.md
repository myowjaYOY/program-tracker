# Database Schema Documentation

**Exported:** January 28, 2026  
**Updated:** February 5, 2026  
**Source:** Supabase Production Database

---

## Tables (63 total)

| Table | Description |
|-------|-------------|
| **audit_event_changes** | Field-level audit trail storing column name, old value, and new value for each changed field. Linked to `audit_events` for complete change history. Used in audit reports and coordinator change history views. |
| **audit_events** | Main audit event log recording table changes across the system. Stores table name, record ID, operation type (INSERT/UPDATE/DELETE), timestamp, and user who made the change. Created automatically by audit triggers on many tables. |
| **bodies** | Reference table for body systems (e.g., "Digestive", "Cardiovascular", "Neurological"). Used to classify therapies and analyze health outcomes by body system. Managed in Admin > Bodies. |
| **buckets** | Category groupings for therapies (e.g., "Core Services", "Add-ons", "Lab Work"). Used to organize therapies in selection lists and program item displays. Managed in Admin > Buckets. |
| **campaigns** | Marketing campaign records for lead generation events (seminars, webinars, etc.). Tracks campaign details, expected attendance, vendor partnerships, and costs (ad spend, food costs). Used for ROI analysis by linking campaigns to generated leads. Managed in Marketing > Campaigns. |
| **cron_job_runs** | Scheduled job execution logs. Tracks automated processes (e.g., membership billing, analytics refresh) with status, duration, and metrics. Used in Admin > System Jobs for monitoring job health. |
| **data_import_errors** | Detailed error records for failed import rows. Stores error messages and row data for troubleshooting. Linked to `data_import_jobs`. |
| **data_import_jobs** | Import batch tracking for survey data imports. Records row counts, success/failure metrics, and timing. Used to monitor import health and identify issues. |
| **financing_types** | Financing options available for programs (e.g., "Full Payment", "3 Pay", "6 Pay", "External Financing"). Includes `financing_source` field (internal/external). Used in program financials to determine payment schedule generation. |
| **inventory_count_details** | Line items within a physical inventory count session. Stores expected quantity vs physical quantity, variance calculations, and approval status (pending/counted/approved/rejected/posted). When posted, creates inventory transactions and updates on-hand quantities. |
| **inventory_count_sessions** | Physical inventory count sessions (cycle counts, full counts, custom). Tracks session metadata including status (in_progress/completed/cancelled), start/end times, and auto-generated session numbers. Managed in Operations > Inventory > Physical Count. |
| **inventory_items** | Inventory master catalog of tracked items linked to therapies. Stores quantity on hand, reorder point, last counted date. Updated when POs are received, items are dispensed, or adjustments are made. Managed in Operations > Inventory. |
| **inventory_transactions** | Immutable audit trail of all inventory movements. Records quantity increases/decreases with reference type (purchase_order, program_item, count_session, manual_adjustment, return). Created automatically via triggers. Used in transaction history views. |
| **item_requests** | Item request workflow for coordinators to request items for members. Tracks lifecycle stages: Requested → Ordered → Received (or Cancelled). Stores timestamps and users for each stage. Managed in Operations > Item Requests. |
| **lead_notes** | Notes attached to leads supporting types: Challenge, Follow-Up, Other, PME, Win. Can be linked to notifications for alert workflows. Displayed in lead detail views with count badges in lead lists. |
| **lead_status_transitions** | Audit history of lead status changes. Automatically populated by trigger when `leads.status_id` changes. Records old/new status, PME date changes, transition source, and timestamp. Used in campaign performance and sales reports. |
| **leads** | Lead/prospect records representing potential members. Stores contact info, lead source (campaign), current status, and PME (Phone Medical Evaluation) dates. Central entity linking campaigns to member programs. Managed in Sales > Leads. |
| **member_analytics_cache** | Pre-calculated program-level analytics metrics for the dashboard. Stores aggregated compliance distributions, health outcome correlations, at-risk member counts. Single-row cache refreshed via analytics API. |
| **member_individual_insights** | AI-generated individual member analytics including quartile rankings, risk assessments (green/yellow/red), and comparative analysis vs. population. Calculated by the analyze-member-progress edge function. |
| **member_program_finances** | Financial summary for a member program. Stores margins, discounts, taxes, finance charges, and final pricing. Margin is locked when program is activated (`contracted_at_margin`). Variance tracks difference between contracted and current margin. |
| **member_program_finances_backup_active_tax_fix** | Temporary backup table created during a tax calculation fix migration. Can be safely removed after verification. |
| **member_program_item_schedule** | Scheduled therapy instances (the "Script"). Each row represents a scheduled appointment/redemption date for a program item. Tracks scheduled date, actual date, completion status (pending/redeemed/missed), and assigned role. Generated by `generate_member_program_schedule()` function. |
| **member_program_item_tasks** | Tasks associated with program items. Copied from `therapy_tasks` when a therapy is added to a program. Tracks task definition, responsible role, and completion status. |
| **member_program_items** | Program line items (therapies) for a member program. Defines therapies, quantities, timing (days_from_start, days_between), and pricing. For memberships, `billing_period_month` tracks which billing cycle items belong to. |
| **member_program_items_task_schedule** | Scheduled task instances linked to schedule instances. Each row is a task due on a specific date. Due date calculated as `scheduled_date + task_delay`. Used in Coordinator To-Do view. Generated by `regen_member_program_task_schedule()` function. |
| **member_program_membership_finances** | Locked monthly billing values for membership programs. Stores monthly rate, discount, and tax that remain consistent regardless of item changes. Only exists for programs where `program_type = 'membership'`. |
| **member_program_payments** | Payment schedule for member programs. Tracks individual payment installments with due dates, amounts, and payment status. Generated by `regenerate_member_program_payments()` function based on financing type or membership rates. |
| **member_program_rasha** | RASHA frequency assignments for member programs. Tracks which RASHA sessions are assigned, grouping, order, and type (individual/group). Copied from `program_template_rasha` when creating program from template. |
| **member_programs** | Member program records representing enrolled members. Links to leads, tracks program metadata (name, duration, start date), status, and totals. Supports both one-time programs and recurring memberships. Core entity for program management. |
| **member_progress_summary** | Pre-calculated member dashboard metrics. Stores health vitals, compliance scores, alerts, timeline, goals, and 40+ other fields including GPT-generated wins/concerns. Primary data source for member progress dashboard. |
| **menu_items** | Navigation menu structure definition. Defines menu paths, labels, icons, and sections (main, marketing, sales, operations, admin). Used by Sidebar component to build navigation. |
| **notifications** | Role-based notification system for workflow alerts. Stores notifications with priority (normal/high/urgent), target roles, status (active/acknowledged), and links to leads and notes. Displayed in notification bell filtered by user role. |
| **payment_methods** | Payment method options (Cash, Check, Credit Card, ACH, Wire Transfer, etc.). Reference table for `member_program_payments`. Managed in Admin > Payment Methods. |
| **payment_status** | Payment lifecycle statuses (Pending, Paid, Late, Cancelled, Refunded). Reference table for `member_program_payments`. Managed in Admin > Payment Status. |
| **pillars** | Reference table for health pillars (e.g., "Detox", "Nutrition", "Movement", "Mindset"). Used to classify therapies for analytics and reporting. Managed in Admin > Pillars. |
| **program_roles** | Role definitions for program items and tasks (Coordinator, Provider, Admin, Member). Includes display color and order. Assigned to therapies, tasks, and schedule instances to determine accountability. Used for role-based filtering in Coordinator views. |
| **program_status** | Program lifecycle statuses (Quote, Active, Paused, Completed, Cancelled, Lost). Used by ProgramStatusService to determine valid programs for operations. Default filter is Active programs only. |
| **program_template** | Reusable program templates with predefined items, tasks, and RASHA sequences. Used to create member programs efficiently. Contains name, description, and calculated totals. Managed in Admin > Program Templates. |
| **program_template_items** | Line items within a program template. Defines therapies, quantities, timing, and pricing that will be copied to `member_program_items` when creating a program from the template. |
| **program_template_rasha** | RASHA frequency sequences assigned to templates. Copied to `member_program_rasha` when creating programs from templates. |
| **purchase_order_items** | Line items on purchase orders. Links therapies to POs with quantities ordered/received and costs. When items are received, triggers create inventory transactions and update on-hand quantities. |
| **purchase_orders** | Purchase order headers tracking vendor, dates, costs, and status. Lifecycle: draft → ordered → partially_received → received. Auto-generates PO numbers. Managed in Operations > Purchase Orders. |
| **rasha_list** | Master reference list of RASHA frequency options with names and lengths (in minutes). Used in program templates and member programs for RASHA session assignments. Managed in Admin > RASHA List. |
| **status** | Lead status options defining the sales pipeline stages (New Lead, PME Scheduled, Confirmed, No Show, Follow Up, Won, Lost, etc.). Used to categorize leads throughout their journey. Managed in Admin > Status. |
| **survey_domain_scores** | Pre-calculated domain scores for MSQ and PROMIS surveys. Stores total score per domain per session with severity assessment. Calculated during survey import to avoid recalculation on each request. |
| **survey_domains** | Scoring domain definitions for standardized surveys (MSQ: head, eyes, digestive, etc.; PROMIS: anxiety, depression, fatigue, etc.). Used to categorize questions and calculate domain-level scores. |
| **survey_form_question_domain** | Many-to-many mapping between survey questions and scoring domains. Links questions to the domains they contribute to for scoring purposes. |
| **survey_forms** | Survey form definitions (MSQ-95, PROMIS-29, Weekly Progress Reports, etc.). Forms are global and reusable across survey modules. Linked to sessions via form_id. |
| **survey_modules** | Survey module definitions within a curriculum. Defines the sequence and timing of surveys in a program (e.g., Week 1, Week 2, Mid-Program). |
| **survey_programs** | Survey program definitions representing complete survey curricula. Contains program-level settings and metadata. |
| **survey_questions** | Individual survey questions with question text, order, and answer type. Linked to forms and optionally to scoring domains. Used when processing and displaying survey responses. |
| **survey_response_sessions** | Completed survey submission records. Each row represents one member completing one survey at a specific time. Tracks completion metadata and links to form and lead. |
| **survey_responses** | Individual survey answers. Supports text, numeric, date, and boolean responses. Linked to sessions and questions. Used in MSQ/PROMIS assessments and progress tracking. |
| **survey_session_program_context** | Links survey response sessions to survey modules/programs for curriculum tracking. Provides context about which module a survey belongs to. |
| **survey_user_mappings** | Maps external survey system user IDs to internal lead IDs. Primary lookup table for connecting imported survey data to CRM members. Created automatically during survey import. |
| **survey_user_progress** | Tracks member progress through survey curriculum modules. Stores which module was last completed, current module, and status (Current/Behind). Used for timeline calculations and overdue alerts. |
| **therapies** | Master catalog of therapy services/products (IV therapy, supplements, appointments, lab work, etc.). Stores name, description, duration, cost, charge, taxability, and default responsible role. Core reference table for program items. Managed in Admin > Therapies. |
| **therapies_bodies_pillars** | Many-to-many junction table linking therapies to body systems and pillars. Used for classifying therapies and analyzing health outcomes by category. |
| **therapy_tasks** | Reusable task definitions linked to therapies. When a therapy is added to a program, its tasks are copied to `member_program_item_tasks`. Defines task name, delay from therapy date, and responsible role. |
| **therapytype** | Therapy categories (IV Therapy, Supplements, Appointments, Lab Work, Equipment, etc.). Used for grouping and filtering therapies. Managed in Admin > Therapy Types. |
| **user_menu_permissions** | Granular menu access control per user. Links users to menu paths they can access. Admins have wildcard access. Used by permissions hook to filter sidebar navigation. |
| **users** | Application user accounts synced from Supabase Auth. Stores email, full name, admin status, active status, assigned role, and app source. Used for authentication, authorization, and audit trails. Managed in Admin > Users. |
| **vendors** | Supplier/vendor master data for campaigns and purchase orders. Stores vendor contact info. Used as dropdown options when creating POs and campaigns. Managed in Admin > Vendors. |

---

## Views (5 total)

| View | Description |
|------|-------------|
| **vw_audit_member_items** | Denormalized view of audit history for member program items. Joins audit events with item and lead details for easy querying in audit reports. |
| **vw_coordinator_item_schedule** | Coordinator "Script" view. Flattens schedule instances with member, therapy, and status details for the coordinator dashboard. Filters to items assigned to coordinator roles. |
| **vw_coordinator_task_schedule** | Coordinator "To-Do" view. Flattens task schedule instances with member, therapy, and status details. Filters to tasks assigned to coordinator roles with due dates. |
| **vw_member_audit_events** | Member-scoped audit events view. Joins audit events with lead info for displaying change history in member context. |
| **vw_purchase_order_audit_history** | PO audit history view. Joins purchase order audit events with user and item details for PO change tracking. |

---

## Key Relationships

### Lead → Program Flow
```
leads (status tracked in lead_status_transitions)
  ↓
member_programs (status changes audited)
  ↓
member_program_items (therapies)
  ↓
member_program_item_schedule (script instances)
  ↓
member_program_items_task_schedule (to-do tasks)
```

### Template → Program Creation Flow
```
program_template → create_member_program_from_template() → member_programs
  ↓                                                           ↓
program_template_items ─────────────────────────────────→ member_program_items
  ↓                                                           ↓
program_template_rasha ─────────────────────────────────→ member_program_rasha
```

### Therapy → Tasks Flow
```
therapies → therapy_tasks (template tasks)
               ↓
           member_program_item_tasks (copied to programs)
               ↓
           member_program_items_task_schedule (scheduled instances)
```

### Survey Data Flow
```
CSV Import → process-survey-import → survey_response_sessions + survey_responses 
                                         ↓
                                     calculateDomainScores() → survey_domain_scores
                                         ↓
                                     analyze-member-progress → member_progress_summary
```

### Inventory Flow
```
purchase_orders → purchase_order_items → inventory_transactions → inventory_items
                       (receive)              (auto-created)        (qty updated)

member_program_item_schedule → inventory_transactions → inventory_items
       (dispense)                  (auto-created)        (qty reduced)
```

### Audit Flow
```
Table Change → Trigger → write_audit_event() → audit_events
                      → write_audit_change() → audit_event_changes
```

---

## Functions (50+ total)

### Audit Functions
| Function | Description |
|----------|-------------|
| audit_lead_status_transition | Captures lead status changes to `lead_status_transitions` |
| audit_member_item_schedule | Audit trigger for schedule changes |
| audit_member_item_task_schedule | Audit trigger for task schedule changes |
| audit_member_program_finances | Audit trigger for finance changes |
| audit_member_program_item_tasks | Audit trigger for task changes |
| audit_member_program_items | Audit trigger for item changes |
| audit_member_program_membership_finances | Audit trigger for membership finances |
| audit_member_program_payments | Audit trigger for payment changes |
| audit_member_programs | Audit trigger for program changes |
| audit_support_trigger | Generic audit trigger for reference tables |
| write_audit_change | Write field change to audit_event_changes |
| write_audit_event | Write event to audit_events |

### Business Logic Functions
| Function | Description |
|----------|-------------|
| adjust_date_for_weekend | Skip weekends when calculating schedule dates |
| adjust_future_schedule_instances | Cascade schedule adjustments when one instance changes |
| calculate_analytics_metrics | Calculate program-level analytics for dashboard cache |
| calculate_po_totals | Recalculate PO totals when line items change |
| compute_pause_days_since_date | Calculate pause days from a specific date |
| compute_program_total_pause_days | Total pause days for a program |
| copy_program_template | Copy a template to create a new template |
| copy_program_template_exact | Exact copy of template preserving all values |
| create_member_program_from_template | Create member program from template |
| generate_member_program_schedule | Generate schedule instances from program items |
| get_monthly_compliance_trends | Compliance trend data for analytics |
| lock_contracted_margin | Lock margin when program status changes to Active |
| pause_member_program | Pause a program and update schedule dates |
| recalculate_templates_on_therapy_change | Recalc template totals when therapy prices change |
| regen_member_program_task_schedule | Regenerate task schedule from tasks |
| regenerate_member_program_payments | Regenerate payment schedule from finances |

### Utility Functions
| Function | Description |
|----------|-------------|
| generate_count_session_number | Auto-generate physical count session number |
| generate_po_number | Auto-generate PO number |
| handle_new_user | Sync auth.users to public.users on signup |
| update_timestamp_function | Auto-update updated_at on row changes |

---

## Triggers by Table

| Table | Triggers |
|-------|----------|
| bodies | tr_audit_support_bodies, update_bodies_timestamp |
| buckets | tr_audit_support_buckets, update_buckets_timestamp |
| campaigns | update_campaigns_timestamp |
| inventory_count_details | trigger_update_count_session_stats |
| inventory_count_sessions | trigger_set_count_session_number, update_count_sessions_timestamp |
| inventory_items | tr_audit_support_inventory_items, update_inventory_items_timestamp |
| inventory_transactions | tr_audit_support_inventory_transactions, update_inventory_transactions_timestamp |
| lead_status_transitions | update_lead_status_transitions_timestamp |
| leads | **tr_audit_lead_status_transition**, update_leads_timestamp |
| member_program_finances | tr_audit_member_program_finances, update_member_program_finances_timestamp |
| member_program_item_schedule | inventory_update_on_schedule_change_trigger, tr_audit_member_item_schedule, update_member_program_item_schedule_timestamp |
| member_program_item_tasks | tr_audit_member_program_item_tasks, update_member_program_item_tasks_timestamp |
| member_program_items | tr_audit_member_program_items, update_member_program_items_timestamp |
| member_program_items_task_schedule | tr_audit_member_item_task_schedule, update_member_program_items_task_schedule_timestamp |
| member_program_membership_finances | tr_audit_member_program_membership_finances, update_member_program_membership_finances_timestamp |
| member_program_payments | tr_audit_member_program_payments, update_member_program_payments_timestamp |
| member_program_rasha | tr_audit_support_member_program_rasha, update_member_program_rasha_timestamp |
| member_programs | tr_audit_member_programs, tr_lock_contracted_margin, update_member_programs_timestamp |
| payment_methods | tr_audit_support_payment_methods, update_payment_methods_timestamp |
| payment_status | tr_audit_support_payment_status, update_payment_status_timestamp |
| pillars | update_pillars_timestamp |
| program_roles | update_program_roles_timestamp |
| program_status | update_program_status_timestamp |
| program_template | update_program_template_timestamp |
| program_template_items | update_program_template_items_timestamp |
| program_template_rasha | tr_audit_support_program_template_rasha, update_program_template_rasha_timestamp |
| purchase_order_items | calculate_po_totals_trigger, inventory_update_on_po_receive_trigger, tr_audit_support_purchase_order_items, update_purchase_order_items_timestamp |
| purchase_orders | generate_po_number_trigger, tr_audit_support_purchase_orders, update_purchase_orders_timestamp |
| rasha_list | update_rasha_list_timestamp |
| status | update_status_timestamp |
| therapies | tr_audit_support_therapies, tr_recalculate_templates_on_therapy_change, update_therapies_timestamp |
| therapies_bodies_pillars | update_therapies_bodies_pillars_timestamp |
| therapy_tasks | update_therapy_tasks_timestamp |
| therapytype | tr_audit_support_therapytype, update_therapy_type_timestamp |
| vendors | update_vendors_timestamp |

---

## Tables with Audit Triggers

| Table | Audit Trigger |
|-------|---------------|
| bodies | tr_audit_support_bodies |
| buckets | tr_audit_support_buckets |
| inventory_items | tr_audit_support_inventory_items |
| inventory_transactions | tr_audit_support_inventory_transactions |
| leads | tr_audit_lead_status_transition |
| member_program_finances | tr_audit_member_program_finances |
| member_program_item_schedule | tr_audit_member_item_schedule |
| member_program_item_tasks | tr_audit_member_program_item_tasks |
| member_program_items | tr_audit_member_program_items |
| member_program_items_task_schedule | tr_audit_member_item_task_schedule |
| member_program_membership_finances | tr_audit_member_program_membership_finances |
| member_program_payments | tr_audit_member_program_payments |
| member_program_rasha | tr_audit_support_member_program_rasha |
| member_programs | tr_audit_member_programs |
| payment_methods | tr_audit_support_payment_methods |
| payment_status | tr_audit_support_payment_status |
| program_template_rasha | tr_audit_support_program_template_rasha |
| purchase_order_items | tr_audit_support_purchase_order_items |
| purchase_orders | tr_audit_support_purchase_orders |
| therapies | tr_audit_support_therapies |
| therapytype | tr_audit_support_therapytype |

---

## Tables WITHOUT Audit Triggers

| Table | Notes |
|-------|-------|
| campaigns | Should consider adding |
| lead_notes | Low priority |
| program_template | Should consider adding |
| program_template_items | Should consider adding |
| vendors | Should consider adding |
| status | Reference data |
| program_status | Reference data |
| program_roles | Reference data |
| All survey_* tables | Survey system |
| users | Auth managed separately |
