-- ============================================================================
-- PROGRAM TRACKER DATABASE SCHEMA BACKUP
-- Generated: December 1, 2025
-- Database: Supabase PostgreSQL
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================
-- Note: These extensions are typically managed by Supabase
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- CREATE EXTENSION IF NOT EXISTS "http";

-- ============================================================================
-- SECTION 2: CUSTOM TYPES (ENUMS)
-- ============================================================================

CREATE TYPE public.financing_source_enum AS ENUM ('internal', 'external');

-- ============================================================================
-- SECTION 3: TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Core Reference Tables
-- ----------------------------------------------------------------------------

-- Users table (synced from auth.users)
CREATE TABLE public.users (
    id UUID NOT NULL PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Status (Lead statuses)
CREATE TABLE public.status (
    status_id SERIAL PRIMARY KEY,
    status_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Program Status
CREATE TABLE public.program_status (
    program_status_id SERIAL PRIMARY KEY,
    status_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Payment Status
CREATE TABLE public.payment_status (
    payment_status_id SERIAL PRIMARY KEY,
    payment_status_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Payment Methods
CREATE TABLE public.payment_methods (
    payment_method_id SERIAL PRIMARY KEY,
    payment_method_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Financing Types
CREATE TABLE public.financing_types (
    financing_type_id SERIAL PRIMARY KEY,
    financing_type_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    financing_source public.financing_source_enum NOT NULL DEFAULT 'internal',
    payment_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Program Roles
CREATE TABLE public.program_roles (
    program_role_id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE,
    description TEXT,
    display_color TEXT CHECK (display_color ~ '^#[0-9A-Fa-f]{6}$'),
    display_order INTEGER,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id),
    CONSTRAINT program_roles_role_name_not_empty CHECK (char_length(role_name) > 0)
);

-- Bodies
CREATE TABLE public.bodies (
    body_id SERIAL PRIMARY KEY,
    body_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Pillars
CREATE TABLE public.pillars (
    pillar_id SERIAL PRIMARY KEY,
    pillar_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Buckets
CREATE TABLE public.buckets (
    bucket_id SERIAL PRIMARY KEY,
    bucket_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Therapy Types
CREATE TABLE public.therapytype (
    therapy_type_id SERIAL PRIMARY KEY,
    therapy_type_name TEXT NOT NULL,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Vendors
CREATE TABLE public.vendors (
    vendor_id SERIAL PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- RASHA List
CREATE TABLE public.rasha_list (
    rasha_list_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    length INTEGER NOT NULL,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID
);

-- ----------------------------------------------------------------------------
-- 3.2 Marketing/Sales Tables
-- ----------------------------------------------------------------------------

-- Campaigns
CREATE TABLE public.campaigns (
    campaign_id SERIAL PRIMARY KEY,
    campaign_name TEXT NOT NULL,
    campaign_date DATE NOT NULL,
    description TEXT NOT NULL,
    confirmed_count INTEGER NOT NULL DEFAULT 0,
    vendor_id INTEGER NOT NULL REFERENCES public.vendors(vendor_id),
    budget NUMERIC(10,2),
    cost NUMERIC(10,2),
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Leads
CREATE TABLE public.leads (
    lead_id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    status_id INTEGER NOT NULL REFERENCES public.status(status_id),
    campaign_id INTEGER NOT NULL REFERENCES public.campaigns(campaign_id),
    birth_date DATE,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Lead Notes
CREATE TABLE public.lead_notes (
    note_id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES public.leads(lead_id),
    note_type VARCHAR(20) NOT NULL CHECK (note_type IN ('Challenge', 'Follow-Up', 'Other', 'PME', 'Win')),
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id)
);

-- ----------------------------------------------------------------------------
-- 3.3 Therapy Tables
-- ----------------------------------------------------------------------------

-- Therapies
CREATE TABLE public.therapies (
    therapy_id SERIAL PRIMARY KEY,
    therapy_name TEXT NOT NULL,
    description TEXT,
    therapy_type_id INTEGER NOT NULL REFERENCES public.therapytype(therapy_type_id),
    bucket_id INTEGER NOT NULL REFERENCES public.buckets(bucket_id),
    cost NUMERIC(9,2) NOT NULL DEFAULT 0,
    charge NUMERIC(9,2) NOT NULL DEFAULT 0,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    sku TEXT,
    upc TEXT,
    units_per_dose TEXT,
    taxable BOOLEAN NOT NULL DEFAULT false,
    program_role_id INTEGER NOT NULL REFERENCES public.program_roles(program_role_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Therapies Bodies Pillars (Junction Table)
CREATE TABLE public.therapies_bodies_pillars (
    therapy_id INTEGER NOT NULL REFERENCES public.therapies(therapy_id),
    body_id INTEGER NOT NULL REFERENCES public.bodies(body_id),
    pillar_id INTEGER NOT NULL REFERENCES public.pillars(pillar_id),
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id),
    PRIMARY KEY (therapy_id, body_id, pillar_id)
);

-- Therapy Tasks
CREATE TABLE public.therapy_tasks (
    task_id SERIAL PRIMARY KEY,
    task_name TEXT NOT NULL,
    description TEXT,
    therapy_id INTEGER NOT NULL REFERENCES public.therapies(therapy_id),
    task_delay INTEGER NOT NULL DEFAULT 0,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    program_role_id INTEGER REFERENCES public.program_roles(program_role_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- ----------------------------------------------------------------------------
-- 3.4 Program Template Tables
-- ----------------------------------------------------------------------------

-- Program Template
CREATE TABLE public.program_template (
    program_template_id SERIAL PRIMARY KEY,
    program_template_name TEXT NOT NULL,
    description TEXT,
    total_cost NUMERIC(9,2),
    total_charge NUMERIC(9,2),
    margin_percentage NUMERIC(5,2),
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Program Template Items
CREATE TABLE public.program_template_items (
    program_template_items_id SERIAL PRIMARY KEY,
    program_template_id INTEGER NOT NULL REFERENCES public.program_template(program_template_id),
    therapy_id INTEGER NOT NULL REFERENCES public.therapies(therapy_id),
    quantity INTEGER NOT NULL DEFAULT 1,
    days_from_start INTEGER NOT NULL DEFAULT 0,
    days_between INTEGER NOT NULL DEFAULT 0,
    instructions TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    program_role_id INTEGER REFERENCES public.program_roles(program_role_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Program Template RASHA
CREATE TABLE public.program_template_rasha (
    program_template_rasha_id SERIAL PRIMARY KEY,
    program_template_id INTEGER NOT NULL REFERENCES public.program_template(program_template_id),
    rasha_list_id INTEGER NOT NULL REFERENCES public.rasha_list(rasha_list_id),
    group_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('individual', 'group')),
    order_number INTEGER NOT NULL,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID
);

-- ----------------------------------------------------------------------------
-- 3.5 Member Program Tables
-- ----------------------------------------------------------------------------

-- Member Programs
CREATE TABLE public.member_programs (
    member_program_id SERIAL PRIMARY KEY,
    program_template_name TEXT NOT NULL,
    lead_id INTEGER REFERENCES public.leads(lead_id),
    description TEXT,
    start_date DATE,
    end_date DATE,
    total_cost NUMERIC(9,2),
    total_charge NUMERIC(9,2),
    source_template_id INTEGER REFERENCES public.program_template(program_template_id),
    active_flag BOOLEAN NOT NULL DEFAULT true,
    program_status_id INTEGER REFERENCES public.program_status(program_status_id),
    duration INTEGER NOT NULL DEFAULT 90,
    program_type TEXT NOT NULL DEFAULT 'one-time' CHECK (program_type IN ('one-time', 'membership')),
    next_billing_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_member_programs_type ON public.member_programs(program_type);
CREATE INDEX idx_member_programs_next_billing ON public.member_programs(next_billing_date) WHERE program_type = 'membership';
CREATE INDEX idx_member_programs_lead_id ON public.member_programs(lead_id);
CREATE INDEX idx_member_programs_status ON public.member_programs(program_status_id);
CREATE INDEX idx_member_programs_source_template ON public.member_programs(source_template_id);

-- Member Program Items
CREATE TABLE public.member_program_items (
    member_program_item_id SERIAL PRIMARY KEY,
    member_program_id INTEGER NOT NULL REFERENCES public.member_programs(member_program_id),
    therapy_id INTEGER NOT NULL REFERENCES public.therapies(therapy_id),
    quantity INTEGER NOT NULL DEFAULT 1,
    item_cost NUMERIC(9,2) NOT NULL DEFAULT 0,
    item_charge NUMERIC(9,2) NOT NULL DEFAULT 0,
    days_from_start INTEGER NOT NULL DEFAULT 0,
    days_between INTEGER NOT NULL DEFAULT 0,
    instructions TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    program_role_id INTEGER REFERENCES public.program_roles(program_role_id),
    billing_period_month INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID
);

CREATE INDEX idx_member_program_items_member_program ON public.member_program_items(member_program_id);
CREATE INDEX idx_member_program_items_therapy ON public.member_program_items(therapy_id);
CREATE INDEX idx_member_program_items_program_role_id ON public.member_program_items(program_role_id) WHERE program_role_id IS NOT NULL;
CREATE INDEX idx_program_items_billing_period ON public.member_program_items(member_program_id, billing_period_month);

-- Member Program Item Tasks
CREATE TABLE public.member_program_item_tasks (
    member_program_item_task_id SERIAL PRIMARY KEY,
    member_program_item_id INTEGER NOT NULL REFERENCES public.member_program_items(member_program_item_id),
    task_id INTEGER NOT NULL REFERENCES public.therapy_tasks(task_id),
    task_name TEXT NOT NULL,
    description TEXT,
    task_delay INTEGER NOT NULL DEFAULT 0,
    completed_flag BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES public.users(id),
    program_role_id INTEGER REFERENCES public.program_roles(program_role_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_member_program_item_tasks_item ON public.member_program_item_tasks(member_program_item_id);
CREATE INDEX idx_member_program_item_tasks_task ON public.member_program_item_tasks(task_id);
CREATE INDEX idx_member_program_item_tasks_completed ON public.member_program_item_tasks(completed_flag);
CREATE INDEX idx_member_program_item_tasks_program_role_id ON public.member_program_item_tasks(program_role_id) WHERE program_role_id IS NOT NULL;

-- Member Program Item Schedule
CREATE TABLE public.member_program_item_schedule (
    member_program_item_schedule_id SERIAL PRIMARY KEY,
    member_program_item_id INTEGER NOT NULL REFERENCES public.member_program_items(member_program_item_id),
    instance_number INTEGER NOT NULL,
    scheduled_date DATE,
    completed_flag BOOLEAN,
    program_role_id INTEGER REFERENCES public.program_roles(program_role_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID,
    CONSTRAINT uniq_item_schedule_instance UNIQUE (member_program_item_id, instance_number)
);

CREATE INDEX idx_member_program_item_schedule_program_item ON public.member_program_item_schedule(member_program_item_id, instance_number);
CREATE INDEX idx_member_program_item_schedule_scheduled_date ON public.member_program_item_schedule(scheduled_date);
CREATE INDEX idx_member_program_item_schedule_program_role_id ON public.member_program_item_schedule(program_role_id) WHERE program_role_id IS NOT NULL;

-- Member Program Items Task Schedule
CREATE TABLE public.member_program_items_task_schedule (
    member_program_item_task_schedule_id SERIAL PRIMARY KEY,
    member_program_item_schedule_id INTEGER NOT NULL REFERENCES public.member_program_item_schedule(member_program_item_schedule_id),
    member_program_item_task_id INTEGER NOT NULL REFERENCES public.member_program_item_tasks(member_program_item_task_id),
    due_date DATE,
    completed_flag BOOLEAN DEFAULT false,
    program_role_id INTEGER REFERENCES public.program_roles(program_role_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID,
    CONSTRAINT uniq_task_schedule_per_occurrence UNIQUE (member_program_item_schedule_id, member_program_item_task_id)
);

CREATE INDEX idx_member_program_items_task_schedule_due_date ON public.member_program_items_task_schedule(due_date);
CREATE INDEX idx_member_program_items_task_schedule_fulfillment ON public.member_program_items_task_schedule(member_program_item_schedule_id);
CREATE INDEX idx_member_program_items_task_schedule_task ON public.member_program_items_task_schedule(member_program_item_task_id);
CREATE INDEX idx_member_program_items_task_schedule_program_role_id ON public.member_program_items_task_schedule(program_role_id) WHERE program_role_id IS NOT NULL;

-- Member Program RASHA
CREATE TABLE public.member_program_rasha (
    member_program_rasha_id SERIAL PRIMARY KEY,
    member_program_id INTEGER NOT NULL REFERENCES public.member_programs(member_program_id),
    rasha_list_id INTEGER NOT NULL REFERENCES public.rasha_list(rasha_list_id),
    group_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('individual', 'group')),
    order_number INTEGER NOT NULL,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID
);

CREATE INDEX idx_member_program_rasha_member_program ON public.member_program_rasha(member_program_id);
CREATE INDEX idx_member_program_rasha_rasha_list ON public.member_program_rasha(rasha_list_id);

-- ----------------------------------------------------------------------------
-- 3.6 Financial Tables
-- ----------------------------------------------------------------------------

-- Member Program Finances
CREATE TABLE public.member_program_finances (
    member_program_finance_id SERIAL PRIMARY KEY,
    member_program_id INTEGER NOT NULL REFERENCES public.member_programs(member_program_id),
    financing_type_id INTEGER REFERENCES public.financing_types(financing_type_id),
    finance_charges NUMERIC(10,2) DEFAULT 0,
    taxes NUMERIC(10,2) DEFAULT 0,
    discounts NUMERIC(10,2) DEFAULT 0,
    final_total_price NUMERIC(10,2),
    margin NUMERIC(5,2),
    contracted_at_margin NUMERIC(5,2),
    credits NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

-- Member Program Membership Finances (for recurring memberships)
CREATE TABLE public.member_program_membership_finances (
    membership_finance_id SERIAL PRIMARY KEY,
    member_program_id INTEGER NOT NULL UNIQUE REFERENCES public.member_programs(member_program_id) ON DELETE CASCADE,
    monthly_rate NUMERIC(10,2) NOT NULL,
    monthly_discount NUMERIC(10,2) DEFAULT 0,
    monthly_finance_charge NUMERIC(10,2) DEFAULT 0,
    billing_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_frequency IN ('monthly', 'quarterly', 'annual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID
);

CREATE INDEX idx_membership_finances_program ON public.member_program_membership_finances(member_program_id);

-- Member Program Payments
CREATE TABLE public.member_program_payments (
    member_program_payment_id SERIAL PRIMARY KEY,
    member_program_id INTEGER NOT NULL REFERENCES public.member_programs(member_program_id),
    payment_amount NUMERIC(10,2) NOT NULL,
    payment_due_date DATE NOT NULL,
    payment_date DATE,
    payment_status_id INTEGER NOT NULL REFERENCES public.payment_status(payment_status_id),
    payment_method_id INTEGER REFERENCES public.payment_methods(payment_method_id),
    payment_reference TEXT,
    notes TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_member_program_payments_program_id ON public.member_program_payments(member_program_id);
CREATE INDEX idx_member_program_payments_status_id ON public.member_program_payments(payment_status_id);
CREATE INDEX idx_member_program_payments_method_id ON public.member_program_payments(payment_method_id);
CREATE INDEX idx_member_program_payments_due_date ON public.member_program_payments(payment_due_date);
CREATE INDEX idx_member_program_payments_payment_date ON public.member_program_payments(payment_date);

-- ----------------------------------------------------------------------------
-- 3.7 Inventory Tables
-- ----------------------------------------------------------------------------

-- Inventory Items
CREATE TABLE public.inventory_items (
    inventory_item_id SERIAL PRIMARY KEY,
    therapy_id INTEGER NOT NULL UNIQUE REFERENCES public.therapies(therapy_id),
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
    reorder_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reorder_quantity >= 0),
    last_count_date DATE,
    notes TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_inventory_items_therapy_id ON public.inventory_items(therapy_id);

-- Inventory Transactions
CREATE TABLE public.inventory_transactions (
    transaction_id SERIAL PRIMARY KEY,
    inventory_item_id INTEGER NOT NULL REFERENCES public.inventory_items(inventory_item_id),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase_receive', 'dispensing', 'adjustment', 'return')),
    quantity_change INTEGER NOT NULL,
    reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN ('purchase_order', 'purchase_order_item', 'program_item', 'member_program_item_schedule', 'count_session', 'manual_adjustment', 'return')),
    reference_id INTEGER NOT NULL,
    unit_cost NUMERIC(10,2),
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_inventory_transactions_inventory_item_id ON public.inventory_transactions(inventory_item_id);
CREATE INDEX idx_inventory_transactions_transaction_date ON public.inventory_transactions(transaction_date);

-- Inventory Count Sessions
CREATE TABLE public.inventory_count_sessions (
    count_session_id SERIAL PRIMARY KEY,
    session_number VARCHAR(50) NOT NULL UNIQUE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    count_type VARCHAR(20) NOT NULL CHECK (count_type IN ('cycle', 'full', 'custom')),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    counted_by UUID REFERENCES public.users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    items_counted INTEGER DEFAULT 0,
    items_with_variance INTEGER DEFAULT 0,
    items_pending_approval INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_count_sessions_date ON public.inventory_count_sessions(session_date DESC);
CREATE INDEX idx_count_sessions_status ON public.inventory_count_sessions(status);
CREATE INDEX idx_count_sessions_counted_by ON public.inventory_count_sessions(counted_by);

-- Inventory Count Details
CREATE TABLE public.inventory_count_details (
    count_detail_id SERIAL PRIMARY KEY,
    count_session_id INTEGER REFERENCES public.inventory_count_sessions(count_session_id),
    inventory_item_id INTEGER REFERENCES public.inventory_items(inventory_item_id),
    expected_quantity INTEGER NOT NULL,
    physical_quantity INTEGER,
    variance INTEGER GENERATED ALWAYS AS (physical_quantity - expected_quantity) STORED,
    variance_reason TEXT,
    requires_approval BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'counted', 'approved', 'rejected', 'posted')),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT inventory_count_details_count_session_id_inventory_item_id_key UNIQUE (count_session_id, inventory_item_id)
);

CREATE INDEX idx_count_details_session ON public.inventory_count_details(count_session_id);
CREATE INDEX idx_count_details_status ON public.inventory_count_details(status);
CREATE INDEX idx_count_details_approval ON public.inventory_count_details(requires_approval) WHERE requires_approval = true;

-- ----------------------------------------------------------------------------
-- 3.8 Purchase Order Tables
-- ----------------------------------------------------------------------------

-- Purchase Orders
CREATE TABLE public.purchase_orders (
    po_id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled')),
    subtotal_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    vendor_name TEXT,
    vendor_contact TEXT,
    notes TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

-- Purchase Order Items
CREATE TABLE public.purchase_order_items (
    po_item_id SERIAL PRIMARY KEY,
    po_id INTEGER NOT NULL REFERENCES public.purchase_orders(po_id),
    therapy_id INTEGER NOT NULL REFERENCES public.therapies(therapy_id),
    quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
    quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost NUMERIC(10,2) NOT NULL,
    line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
    notes TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_purchase_order_items_po_id ON public.purchase_order_items(po_id);
CREATE INDEX idx_purchase_order_items_therapy_id ON public.purchase_order_items(therapy_id);

-- ----------------------------------------------------------------------------
-- 3.9 Item Requests
-- ----------------------------------------------------------------------------

CREATE TABLE public.item_requests (
    item_request_id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES public.leads(lead_id),
    item_description TEXT NOT NULL,
    quantity INTEGER CHECK (quantity > 0),
    urgency TEXT,
    requested_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    requested_by UUID NOT NULL,
    ordered_date TIMESTAMP WITH TIME ZONE,
    ordered_by UUID,
    received_date TIMESTAMP WITH TIME ZONE,
    received_by UUID,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    cancelled_date TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT cancelled_requires_dates CHECK (
        (NOT is_cancelled) OR (is_cancelled AND cancelled_date IS NOT NULL AND cancelled_by IS NOT NULL)
    ),
    CONSTRAINT ordered_requires_dates CHECK (
        (ordered_date IS NULL AND ordered_by IS NULL) OR (ordered_date IS NOT NULL AND ordered_by IS NOT NULL)
    ),
    CONSTRAINT received_requires_dates CHECK (
        (received_date IS NULL AND received_by IS NULL) OR (received_date IS NOT NULL AND received_by IS NOT NULL)
    ),
    CONSTRAINT received_after_ordered CHECK (
        received_date IS NULL OR ordered_date IS NOT NULL
    )
);

CREATE INDEX idx_item_requests_lead_id ON public.item_requests(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_item_requests_requested_by ON public.item_requests(requested_by);
CREATE INDEX idx_item_requests_requested_date ON public.item_requests(requested_date DESC);
CREATE INDEX idx_item_requests_is_cancelled ON public.item_requests(is_cancelled) WHERE is_cancelled = true;
CREATE INDEX idx_item_requests_status_lookup ON public.item_requests(is_cancelled, received_date, ordered_date);

-- ----------------------------------------------------------------------------
-- 3.10 Data Import Tables
-- ----------------------------------------------------------------------------

-- Data Import Jobs
CREATE TABLE public.data_import_jobs (
    import_batch_id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    entity_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_summary TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_data_import_batches_status ON public.data_import_jobs(status);
CREATE INDEX idx_data_import_batches_entity_type ON public.data_import_jobs(entity_type);
CREATE INDEX idx_data_import_batches_created_at ON public.data_import_jobs(created_at DESC);
CREATE INDEX idx_data_import_batches_created_by ON public.data_import_jobs(created_by);

-- Data Import Errors
CREATE TABLE public.data_import_errors (
    import_error_id SERIAL PRIMARY KEY,
    import_batch_id INTEGER NOT NULL REFERENCES public.data_import_jobs(import_batch_id),
    row_number INTEGER NOT NULL,
    row_data JSONB,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    field_name TEXT,
    severity TEXT DEFAULT 'error',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_data_import_errors_batch ON public.data_import_errors(import_batch_id);
CREATE INDEX idx_data_import_errors_row ON public.data_import_errors(import_batch_id, row_number);
CREATE INDEX idx_data_import_errors_type ON public.data_import_errors(error_type);
CREATE INDEX idx_data_import_errors_severity ON public.data_import_errors(severity);

-- ----------------------------------------------------------------------------
-- 3.11 Audit Tables
-- ----------------------------------------------------------------------------

-- Audit Events
CREATE TABLE public.audit_events (
    event_id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id BIGINT,
    record_pk TEXT,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    actor_user_id UUID,
    event_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    scope TEXT NOT NULL DEFAULT 'support' CHECK (scope IN ('support', 'member')),
    related_member_id BIGINT,
    related_program_id BIGINT,
    summary TEXT,
    context JSONB,
    old_row JSONB,
    new_row JSONB
);

CREATE INDEX idx_aevt_tbl_rec ON public.audit_events(table_name, record_id);
CREATE INDEX idx_aevt_when ON public.audit_events(event_at);
CREATE INDEX idx_aevt_scope ON public.audit_events(scope);
CREATE INDEX idx_aevt_member ON public.audit_events(related_member_id, related_program_id);

-- Audit Event Changes
CREATE TABLE public.audit_event_changes (
    event_id BIGINT NOT NULL REFERENCES public.audit_events(event_id),
    column_name TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    PRIMARY KEY (event_id, column_name)
);

CREATE INDEX idx_aevtchg_col ON public.audit_event_changes(column_name);

-- ----------------------------------------------------------------------------
-- 3.12 Survey Tables
-- ----------------------------------------------------------------------------

-- Survey Programs
CREATE TABLE public.survey_programs (
    program_id SERIAL PRIMARY KEY,
    program_name TEXT NOT NULL UNIQUE,
    description TEXT,
    duration_weeks INTEGER,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Survey Modules
CREATE TABLE public.survey_modules (
    module_id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES public.survey_programs(program_id),
    module_name TEXT NOT NULL,
    module_order INTEGER,
    description TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT survey_modules_program_id_module_name_key UNIQUE (program_id, module_name)
);

CREATE INDEX idx_survey_modules_program_id ON public.survey_modules(program_id);

-- Survey Forms
CREATE TABLE public.survey_forms (
    form_id SERIAL PRIMARY KEY,
    form_name TEXT NOT NULL UNIQUE,
    description TEXT,
    form_type TEXT,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Survey Questions
CREATE TABLE public.survey_questions (
    question_id SERIAL PRIMARY KEY,
    form_id INTEGER NOT NULL REFERENCES public.survey_forms(form_id),
    question_text TEXT NOT NULL,
    question_order INTEGER,
    answer_type TEXT NOT NULL,
    min_value INTEGER,
    max_value INTEGER,
    options JSONB,
    required BOOLEAN DEFAULT true,
    active_flag BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT survey_questions_form_id_question_text_key UNIQUE (form_id, question_text)
);

CREATE INDEX idx_survey_questions_form_id ON public.survey_questions(form_id);

-- Survey Domains
CREATE TABLE public.survey_domains (
    domain_key TEXT PRIMARY KEY,
    domain_label TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Survey Form Question Domain (mapping questions to domains)
CREATE TABLE public.survey_form_question_domain (
    question_id INTEGER PRIMARY KEY REFERENCES public.survey_questions(question_id),
    domain_key TEXT NOT NULL REFERENCES public.survey_domains(domain_key),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Survey User Mappings
CREATE TABLE public.survey_user_mappings (
    mapping_id SERIAL PRIMARY KEY,
    external_user_id TEXT NOT NULL UNIQUE,
    lead_id INTEGER NOT NULL REFERENCES public.leads(lead_id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    match_confidence TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_survey_user_mappings_external_user_id ON public.survey_user_mappings(external_user_id);
CREATE INDEX idx_survey_user_mappings_lead_id ON public.survey_user_mappings(lead_id);

-- Survey Response Sessions
CREATE TABLE public.survey_response_sessions (
    session_id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES public.leads(lead_id),
    external_user_id TEXT NOT NULL,
    form_id INTEGER NOT NULL REFERENCES public.survey_forms(form_id),
    completed_on TIMESTAMP WITH TIME ZONE NOT NULL,
    total_score NUMERIC,
    import_batch_id INTEGER REFERENCES public.data_import_jobs(import_batch_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_survey_response_sessions_lead_id ON public.survey_response_sessions(lead_id);
CREATE INDEX idx_survey_response_sessions_form_id ON public.survey_response_sessions(form_id);
CREATE INDEX idx_survey_response_sessions_completed_on ON public.survey_response_sessions(completed_on);
CREATE INDEX idx_survey_response_sessions_import_batch_id ON public.survey_response_sessions(import_batch_id);

-- Survey Session Program Context
CREATE TABLE public.survey_session_program_context (
    context_id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL UNIQUE REFERENCES public.survey_response_sessions(session_id),
    program_id INTEGER NOT NULL REFERENCES public.survey_programs(program_id),
    module_id INTEGER NOT NULL REFERENCES public.survey_modules(module_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_survey_session_context_session_id ON public.survey_session_program_context(session_id);
CREATE INDEX idx_survey_session_context_program_id ON public.survey_session_program_context(program_id);
CREATE INDEX idx_survey_session_context_module_id ON public.survey_session_program_context(module_id);

-- Survey Responses
CREATE TABLE public.survey_responses (
    response_id BIGSERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES public.survey_response_sessions(session_id),
    question_id INTEGER NOT NULL REFERENCES public.survey_questions(question_id),
    answer_text TEXT,
    answer_numeric NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_survey_responses_session_id ON public.survey_responses(session_id);
CREATE INDEX idx_survey_responses_question_id ON public.survey_responses(question_id);

-- Survey Domain Scores
CREATE TABLE public.survey_domain_scores (
    domain_score_id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES public.survey_response_sessions(session_id),
    external_user_id TEXT NOT NULL,
    lead_id INTEGER NOT NULL,
    form_id INTEGER NOT NULL,
    completed_on TIMESTAMP WITH TIME ZONE NOT NULL,
    domain_key TEXT NOT NULL REFERENCES public.survey_domains(domain_key),
    domain_total_score NUMERIC NOT NULL,
    severity_assessment TEXT NOT NULL CHECK (severity_assessment IN ('minimal', 'mild', 'moderate', 'severe')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_session_domain UNIQUE (session_id, domain_key)
);

CREATE INDEX idx_survey_domain_scores_session_id ON public.survey_domain_scores(session_id);
CREATE INDEX idx_survey_domain_scores_domain_key ON public.survey_domain_scores(domain_key);
CREATE INDEX idx_survey_domain_scores_external_user_id ON public.survey_domain_scores(external_user_id);
CREATE INDEX idx_survey_domain_scores_completed_on ON public.survey_domain_scores(completed_on);
CREATE INDEX idx_survey_domain_scores_severity ON public.survey_domain_scores(severity_assessment);

-- Survey User Progress
CREATE TABLE public.survey_user_progress (
    progress_id BIGSERIAL PRIMARY KEY,
    mapping_id INTEGER NOT NULL REFERENCES public.survey_user_mappings(mapping_id),
    program_id INTEGER NOT NULL REFERENCES public.survey_programs(program_id),
    registration_date DATE NOT NULL,
    start_date DATE NOT NULL,
    projected_completion_date DATE NOT NULL,
    status TEXT NOT NULL,
    actual_completion_date DATE,
    current_module_id INTEGER,
    last_activity_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT survey_user_progress_user_program_unique UNIQUE (mapping_id, program_id)
);

CREATE INDEX idx_survey_user_progress_mapping_id ON public.survey_user_progress(mapping_id);
CREATE INDEX idx_survey_user_progress_program_id ON public.survey_user_progress(program_id);
CREATE INDEX idx_survey_user_progress_status ON public.survey_user_progress(status);

-- ----------------------------------------------------------------------------
-- 3.13 Analytics Tables
-- ----------------------------------------------------------------------------

-- Member Analytics Cache
CREATE TABLE public.member_analytics_cache (
    cache_id SERIAL PRIMARY KEY,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    member_count INTEGER NOT NULL,
    active_member_count INTEGER NOT NULL,
    completed_member_count INTEGER NOT NULL,
    calculation_duration_ms INTEGER,
    compliance_distribution JSONB,
    avg_compliance_by_category JSONB,
    compliance_timeline JSONB,
    compliance_msq_correlation NUMERIC(5,3) CHECK (compliance_msq_correlation IS NULL OR (compliance_msq_correlation >= -1 AND compliance_msq_correlation <= 1)),
    compliance_promis_correlation NUMERIC(5,3) CHECK (compliance_promis_correlation IS NULL OR (compliance_promis_correlation >= -1 AND compliance_promis_correlation <= 1)),
    compliance_success_rates JSONB,
    compliance_effect_size JSONB,
    compliance_odds_ratio JSONB,
    promis_success_rates JSONB,
    promis_effect_size JSONB,
    promis_odds_ratio JSONB,
    compliance_msq_scatter JSONB,
    health_vitals_by_tier JSONB,
    at_risk_members JSONB,
    bottleneck_modules JSONB,
    missed_items_patterns JSONB,
    cohort_analysis JSONB,
    completion_statistics JSONB
);

CREATE INDEX idx_analytics_cache_calculated_at ON public.member_analytics_cache(calculated_at DESC);

-- Member Individual Insights
CREATE TABLE public.member_individual_insights (
    insight_id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL UNIQUE REFERENCES public.leads(lead_id),
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    compliance_score NUMERIC,
    msq_first_score NUMERIC,
    msq_last_score NUMERIC,
    msq_improvement NUMERIC,
    quartile INTEGER,
    risk_level TEXT,
    recommendations JSONB
);

CREATE INDEX idx_member_insights_lead ON public.member_individual_insights(lead_id);
CREATE INDEX idx_member_insights_calculated ON public.member_individual_insights(calculated_at DESC);
CREATE INDEX idx_member_insights_quartile ON public.member_individual_insights(quartile);
CREATE INDEX idx_member_insights_risk ON public.member_individual_insights(risk_level);

-- Member Progress Summary
CREATE TABLE public.member_progress_summary (
    lead_id INTEGER PRIMARY KEY REFERENCES public.leads(lead_id),
    calculated_at TIMESTAMP WITH TIME ZONE,
    total_surveys_completed INTEGER,
    last_survey_date DATE,
    days_in_program INTEGER,
    status_score NUMERIC,
    status_indicator TEXT CHECK (status_indicator IN ('green', 'yellow', 'red')),
    nutrition_compliance_pct NUMERIC,
    supplements_compliance_pct NUMERIC,
    exercise_compliance_pct NUMERIC,
    meditation_compliance_pct NUMERIC,
    energy_score NUMERIC,
    mood_score NUMERIC,
    motivation_score NUMERIC,
    wellbeing_score NUMERIC,
    sleep_score NUMERIC,
    energy_trend TEXT CHECK (energy_trend IN ('improving', 'stable', 'declining', 'no_data')),
    mood_trend TEXT CHECK (mood_trend IN ('improving', 'stable', 'declining', 'no_data')),
    motivation_trend TEXT CHECK (motivation_trend IN ('improving', 'stable', 'declining', 'no_data')),
    wellbeing_trend TEXT CHECK (wellbeing_trend IN ('improving', 'stable', 'declining', 'no_data')),
    sleep_trend TEXT CHECK (sleep_trend IN ('improving', 'stable', 'declining', 'no_data')),
    last_import_batch_id INTEGER REFERENCES public.data_import_jobs(import_batch_id)
);

CREATE INDEX idx_member_progress_lead_id ON public.member_progress_summary(lead_id);
CREATE INDEX idx_member_progress_calculated_at ON public.member_progress_summary(calculated_at);
CREATE INDEX idx_member_progress_status ON public.member_progress_summary(status_indicator);

-- ----------------------------------------------------------------------------
-- 3.14 Menu & Permissions Tables
-- ----------------------------------------------------------------------------

-- Menu Items
CREATE TABLE public.menu_items (
    id SERIAL PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    section TEXT NOT NULL,
    icon TEXT,
    parent_path TEXT,
    sort_order INTEGER,
    requires_admin BOOLEAN DEFAULT false
);

CREATE INDEX idx_menu_items_section ON public.menu_items(section);

-- User Menu Permissions
CREATE TABLE public.user_menu_permissions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    menu_path TEXT NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    granted_by UUID REFERENCES public.users(id),
    CONSTRAINT user_menu_permissions_user_id_menu_path_key UNIQUE (user_id, menu_path)
);

CREATE INDEX idx_user_menu_permissions_user_id ON public.user_menu_permissions(user_id);
CREATE INDEX idx_user_menu_permissions_path ON public.user_menu_permissions(menu_path);

-- ============================================================================
-- SECTION 4: VIEWS
-- ============================================================================

-- Coordinator Item Schedule View
CREATE OR REPLACE VIEW public.vw_coordinator_item_schedule AS
SELECT 
    s.member_program_item_schedule_id,
    s.member_program_item_id,
    i.member_program_id,
    p.lead_id,
    s.instance_number,
    s.scheduled_date,
    s.completed_flag,
    s.created_at,
    s.created_by,
    s.updated_at,
    s.updated_by,
    s.program_role_id,
    i.therapy_id,
    th.therapy_name,
    tht.therapy_type_id,
    tht.therapy_type_name,
    i.quantity,
    i.item_cost,
    i.item_charge,
    i.days_from_start,
    i.days_between,
    i.instructions,
    i.active_flag AS item_active_flag,
    pr.role_name,
    pr.display_color AS role_display_color,
    p.program_template_name,
    p.program_status_id,
    ps.status_name AS program_status_name,
    p.start_date AS program_start_date,
    p.active_flag AS program_active_flag,
    l.first_name AS member_first_name,
    l.last_name AS member_last_name,
    l.first_name || ' ' || l.last_name AS member_name
FROM member_program_item_schedule s
JOIN member_program_items i ON s.member_program_item_id = i.member_program_item_id
JOIN member_programs p ON i.member_program_id = p.member_program_id
LEFT JOIN therapies th ON i.therapy_id = th.therapy_id
LEFT JOIN therapytype tht ON th.therapy_type_id = tht.therapy_type_id
LEFT JOIN program_roles pr ON s.program_role_id = pr.program_role_id
LEFT JOIN program_status ps ON p.program_status_id = ps.program_status_id
LEFT JOIN leads l ON p.lead_id = l.lead_id;

-- Coordinator Task Schedule View
CREATE OR REPLACE VIEW public.vw_coordinator_task_schedule AS
SELECT 
    ts.member_program_item_task_schedule_id,
    ts.member_program_item_schedule_id,
    ts.member_program_item_task_id,
    s.member_program_item_id,
    i.member_program_id,
    p.lead_id,
    ts.due_date,
    ts.completed_flag,
    ts.created_at,
    ts.created_by,
    ts.updated_at,
    ts.updated_by,
    ts.program_role_id,
    t.task_id,
    t.task_name,
    t.description AS task_description,
    t.task_delay,
    tt.therapy_id,
    th.therapy_name,
    tht.therapy_type_id,
    tht.therapy_type_name,
    pr.role_name,
    pr.display_color AS role_display_color,
    p.program_template_name,
    p.program_status_id,
    ps.status_name AS program_status_name,
    p.start_date AS program_start_date,
    p.active_flag AS program_active_flag,
    l.first_name AS member_first_name,
    l.last_name AS member_last_name,
    l.first_name || ' ' || l.last_name AS member_name
FROM member_program_items_task_schedule ts
JOIN member_program_item_schedule s ON ts.member_program_item_schedule_id = s.member_program_item_schedule_id
JOIN member_program_items i ON s.member_program_item_id = i.member_program_item_id
JOIN member_programs p ON i.member_program_id = p.member_program_id
LEFT JOIN member_program_item_tasks t ON ts.member_program_item_task_id = t.member_program_item_task_id
LEFT JOIN therapy_tasks tt ON t.task_id = tt.task_id
LEFT JOIN therapies th ON tt.therapy_id = th.therapy_id
LEFT JOIN therapytype tht ON th.therapy_type_id = tht.therapy_type_id
LEFT JOIN program_roles pr ON ts.program_role_id = pr.program_role_id
LEFT JOIN program_status ps ON p.program_status_id = ps.program_status_id
LEFT JOIN leads l ON p.lead_id = l.lead_id;

-- Member Audit Events View
CREATE OR REPLACE VIEW public.vw_member_audit_events AS
SELECT 
    e.event_id AS id,
    e.event_at,
    e.table_name,
    e.operation,
    e.actor_user_id AS changed_by,
    u.email AS changed_by_email,
    e.related_member_id,
    l.first_name || ' ' || l.last_name AS related_member_name,
    e.related_program_id,
    mp.program_template_name AS related_program_name,
    e.summary,
    e.context,
    (SELECT jsonb_agg(jsonb_build_object('column', c.column_name, 'old', c.old_value, 'new', c.new_value) ORDER BY c.column_name)
     FROM audit_event_changes c
     WHERE c.event_id = e.event_id) AS changes
FROM audit_events e
LEFT JOIN member_programs mp ON mp.member_program_id = e.related_program_id
LEFT JOIN leads l ON l.lead_id = e.related_member_id
LEFT JOIN users u ON u.id = e.actor_user_id
WHERE e.scope = 'member';

-- ============================================================================
-- SECTION 5: FUNCTIONS
-- ============================================================================

-- Update Timestamp Function
CREATE OR REPLACE FUNCTION public.update_timestamp_function()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Write Audit Event
CREATE OR REPLACE FUNCTION public.write_audit_event(
    p_table_name TEXT,
    p_record_id BIGINT,
    p_record_pk TEXT DEFAULT NULL,
    p_operation TEXT DEFAULT NULL,
    p_actor UUID DEFAULT NULL,
    p_scope TEXT DEFAULT 'support',
    p_related_member_id BIGINT DEFAULT NULL,
    p_related_program_id BIGINT DEFAULT NULL,
    p_summary TEXT DEFAULT NULL,
    p_context JSONB DEFAULT NULL,
    p_old JSONB DEFAULT NULL,
    p_new JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
  INSERT INTO public.audit_events(
    table_name, record_id, record_pk, operation, actor_user_id, scope,
    related_member_id, related_program_id, summary, context, old_row, new_row
  ) VALUES (
    p_table_name, p_record_id, p_record_pk, p_operation, p_actor, COALESCE(p_scope,'support'),
    p_related_member_id, p_related_program_id, p_summary, p_context, p_old, p_new
  ) RETURNING event_id;
$$ LANGUAGE SQL;

-- Write Audit Change
CREATE OR REPLACE FUNCTION public.write_audit_change(
    p_event_id BIGINT,
    p_column_name TEXT,
    p_old JSONB,
    p_new JSONB
)
RETURNS VOID AS $$
  INSERT INTO public.audit_event_changes(event_id, column_name, old_value, new_value)
  VALUES (p_event_id, p_column_name, p_old, p_new)
  ON CONFLICT (event_id, column_name) DO NOTHING;
$$ LANGUAGE SQL;

-- Adjust Date for Weekend
CREATE OR REPLACE FUNCTION public.adjust_date_for_weekend(input_date DATE)
RETURNS DATE AS $$
BEGIN
  CASE EXTRACT(DOW FROM input_date)
    WHEN 0 THEN RETURN input_date + INTERVAL '1 day';
    WHEN 6 THEN RETURN input_date - INTERVAL '1 day';
    ELSE RETURN input_date;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Generate PO Number
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
    year_val VARCHAR(4);
    next_num INTEGER;
BEGIN
    year_val := EXTRACT(YEAR FROM now())::VARCHAR;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO-....-(\\d+)$') AS INTEGER)), 0) + 1
    INTO next_num
    FROM purchase_orders 
    WHERE po_number LIKE 'PO-' || year_val || '-%';
    
    IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
        NEW.po_number := 'PO-' || year_val || '-' || LPAD(next_num::VARCHAR, 3, '0');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generate Count Session Number
CREATE OR REPLACE FUNCTION public.generate_count_session_number()
RETURNS TEXT AS $$
DECLARE
  session_num TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter
  FROM inventory_count_sessions
  WHERE session_date = CURRENT_DATE;
  
  session_num := 'PC-' || TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') || '-' || LPAD(counter::TEXT, 3, '0');
  RETURN session_num;
END;
$$ LANGUAGE plpgsql;

-- Set Count Session Number Trigger Function
CREATE OR REPLACE FUNCTION public.set_count_session_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_number IS NULL OR NEW.session_number = '' THEN
    NEW.session_number := generate_count_session_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate PO Totals
CREATE OR REPLACE FUNCTION public.calculate_po_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE purchase_orders 
    SET 
        subtotal_cost = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM purchase_order_items 
            WHERE po_id = NEW.po_id AND active_flag = true
        ),
        total_cost = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM purchase_order_items 
            WHERE po_id = NEW.po_id AND active_flag = true
        ) + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0),
        updated_at = now(),
        updated_by = NEW.updated_by
    WHERE po_id = NEW.po_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update Count Session Stats
CREATE OR REPLACE FUNCTION public.update_count_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_count_sessions
  SET 
    items_counted = (
      SELECT COUNT(*) 
      FROM inventory_count_details 
      WHERE count_session_id = NEW.count_session_id 
        AND physical_quantity IS NOT NULL
    ),
    items_with_variance = (
      SELECT COUNT(*) 
      FROM inventory_count_details 
      WHERE count_session_id = NEW.count_session_id 
        AND physical_quantity IS NOT NULL
        AND variance != 0
    ),
    items_pending_approval = (
      SELECT COUNT(*) 
      FROM inventory_count_details 
      WHERE count_session_id = NEW.count_session_id 
        AND requires_approval = TRUE
        AND status NOT IN ('approved', 'rejected', 'posted')
    ),
    updated_at = NOW()
  WHERE count_session_id = NEW.count_session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Handle New User (sync from auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lock Contracted Margin (on activation)
CREATE OR REPLACE FUNCTION public.lock_contracted_margin()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status_name TEXT;
  v_old_status_name TEXT;
BEGIN
  IF OLD.program_status_id IS DISTINCT FROM NEW.program_status_id THEN
    SELECT status_name INTO v_new_status_name
    FROM program_status
    WHERE program_status_id = NEW.program_status_id;
    
    SELECT status_name INTO v_old_status_name
    FROM program_status
    WHERE program_status_id = OLD.program_status_id;
    
    IF LOWER(v_new_status_name) = 'active' 
       AND LOWER(COALESCE(v_old_status_name, '')) = 'quote' THEN
      
      UPDATE member_program_finances
      SET contracted_at_margin = margin
      WHERE member_program_id = NEW.member_program_id
        AND contracted_at_margin IS NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 6: TRIGGERS
-- ============================================================================

-- Timestamp Triggers
CREATE TRIGGER update_bodies_timestamp BEFORE UPDATE ON public.bodies FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_buckets_timestamp BEFORE UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_campaigns_timestamp BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_financing_types_timestamp BEFORE UPDATE ON public.financing_types FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_leads_timestamp BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_finances_timestamp BEFORE UPDATE ON public.member_program_finances FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_item_schedule_timestamp BEFORE UPDATE ON public.member_program_item_schedule FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_item_tasks_timestamp BEFORE UPDATE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_items_timestamp BEFORE UPDATE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_items_task_schedule_timestamp BEFORE UPDATE ON public.member_program_items_task_schedule FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_membership_finances_timestamp BEFORE UPDATE ON public.member_program_membership_finances FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_payments_timestamp BEFORE UPDATE ON public.member_program_payments FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_rasha_timestamp BEFORE UPDATE ON public.member_program_rasha FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_programs_timestamp BEFORE UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_payment_methods_timestamp BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_payment_status_timestamp BEFORE UPDATE ON public.payment_status FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_pillars_timestamp BEFORE UPDATE ON public.pillars FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_roles_timestamp BEFORE UPDATE ON public.program_roles FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_status_timestamp BEFORE UPDATE ON public.program_status FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_template_timestamp BEFORE UPDATE ON public.program_template FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_template_items_timestamp BEFORE UPDATE ON public.program_template_items FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_template_rasha_timestamp BEFORE UPDATE ON public.program_template_rasha FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_purchase_order_items_timestamp BEFORE UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_purchase_orders_timestamp BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_rasha_list_timestamp BEFORE UPDATE ON public.rasha_list FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_status_timestamp BEFORE UPDATE ON public.status FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_therapies_timestamp BEFORE UPDATE ON public.therapies FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_therapies_bodies_pillars_timestamp BEFORE UPDATE ON public.therapies_bodies_pillars FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_therapy_tasks_timestamp BEFORE UPDATE ON public.therapy_tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_therapy_type_timestamp BEFORE UPDATE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_vendors_timestamp BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_count_sessions_timestamp BEFORE UPDATE ON public.inventory_count_sessions FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_inventory_items_timestamp BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_inventory_transactions_timestamp BEFORE UPDATE ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();

-- PO Number Generation Trigger
CREATE TRIGGER generate_po_number_trigger BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION generate_po_number();

-- PO Totals Calculation Trigger
CREATE TRIGGER calculate_po_totals_trigger AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION calculate_po_totals();

-- Count Session Number Trigger
CREATE TRIGGER trigger_set_count_session_number BEFORE INSERT ON public.inventory_count_sessions FOR EACH ROW EXECUTE FUNCTION set_count_session_number();

-- Count Session Stats Trigger
CREATE TRIGGER trigger_update_count_session_stats AFTER INSERT OR UPDATE ON public.inventory_count_details FOR EACH ROW EXECUTE FUNCTION update_count_session_stats();

-- Lock Contracted Margin Trigger
CREATE TRIGGER tr_lock_contracted_margin AFTER UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION lock_contracted_margin();

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.audit_event_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_item_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_item_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_items_task_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_membership_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_rasha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_progress_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_template_rasha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rasha_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_domain_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_form_question_domain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_response_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_session_program_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapies_bodies_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapytype ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Standard Authenticated Access Policies (most tables)
CREATE POLICY authenticated_access_audit_event_changes ON public.audit_event_changes FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_audit_event_changes ON public.audit_event_changes FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_audit_events ON public.audit_events FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_audit_events ON public.audit_events FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_bodies ON public.bodies FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_bodies ON public.bodies FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_buckets ON public.buckets FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_buckets ON public.buckets FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_campaigns ON public.campaigns FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_campaigns ON public.campaigns FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_financing_types ON public.financing_types FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_financing_types ON public.financing_types FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_item_requests ON public.item_requests FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_item_requests ON public.item_requests FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_leads ON public.leads FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_leads ON public.leads FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_analytics_cache ON public.member_analytics_cache FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_analytics_cache ON public.member_analytics_cache FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_program_finances ON public.member_program_finances FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_program_finances ON public.member_program_finances FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_program_item_schedule ON public.member_program_item_schedule FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_program_item_schedule ON public.member_program_item_schedule FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_program_item_tasks ON public.member_program_item_tasks FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_program_item_tasks ON public.member_program_item_tasks FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_program_items ON public.member_program_items FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_program_items ON public.member_program_items FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_program_items_task_schedule ON public.member_program_items_task_schedule FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_program_items_task_schedule ON public.member_program_items_task_schedule FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_program_membership_finances ON public.member_program_membership_finances FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_program_membership_finances ON public.member_program_membership_finances FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_program_payments ON public.member_program_payments FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_program_payments ON public.member_program_payments FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_program_rasha ON public.member_program_rasha FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_rls_member_program_rasha ON public.member_program_rasha FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_member_programs ON public.member_programs FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_programs ON public.member_programs FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_menu_items ON public.menu_items FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_menu_items ON public.menu_items FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_payment_methods ON public.payment_methods FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_payment_methods ON public.payment_methods FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_payment_status ON public.payment_status FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_payment_status ON public.payment_status FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_pillars ON public.pillars FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_pillars ON public.pillars FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_program_roles ON public.program_roles FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_program_roles ON public.program_roles FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_program_status ON public.program_status FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_program_status ON public.program_status FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_program_template ON public.program_template FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_program_template ON public.program_template FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_program_template_items ON public.program_template_items FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_program_template_items ON public.program_template_items FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_program_template_rasha ON public.program_template_rasha FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_rls_program_template_rasha ON public.program_template_rasha FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_rasha_list ON public.rasha_list FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_rls_rasha_list ON public.rasha_list FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_status ON public.status FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_status ON public.status FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_domain_scores ON public.survey_domain_scores FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_domain_scores ON public.survey_domain_scores FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_domains ON public.survey_domains FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_domains ON public.survey_domains FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_form_question_domain ON public.survey_form_question_domain FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_form_question_domain ON public.survey_form_question_domain FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_forms ON public.survey_forms FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_forms ON public.survey_forms FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_modules ON public.survey_modules FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_modules ON public.survey_modules FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_programs ON public.survey_programs FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_programs ON public.survey_programs FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_questions ON public.survey_questions FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_questions ON public.survey_questions FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_response_sessions ON public.survey_response_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_response_sessions ON public.survey_response_sessions FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_responses ON public.survey_responses FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_responses ON public.survey_responses FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_session_program_context ON public.survey_session_program_context FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_session_program_context ON public.survey_session_program_context FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_user_mappings ON public.survey_user_mappings FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_user_mappings ON public.survey_user_mappings FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_survey_user_progress ON public.survey_user_progress FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_survey_user_progress ON public.survey_user_progress FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_therapies ON public.therapies FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_therapies ON public.therapies FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_therapies_bodies_pillars ON public.therapies_bodies_pillars FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_therapies_bodies_pillars ON public.therapies_bodies_pillars FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_therapy_tasks ON public.therapy_tasks FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_therapy_tasks ON public.therapy_tasks FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_therapytype ON public.therapytype FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_therapytype ON public.therapytype FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_user_menu_permissions ON public.user_menu_permissions FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_user_menu_permissions ON public.user_menu_permissions FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_users ON public.users FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_users ON public.users FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_vendors ON public.vendors FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_vendors ON public.vendors FOR ALL TO service_role USING (true);

-- Data Import Tables
CREATE POLICY authenticated_access_data_import_jobs ON public.data_import_jobs FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_data_import_jobs ON public.data_import_jobs FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_data_import_errors ON public.data_import_errors FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_data_import_errors ON public.data_import_errors FOR ALL TO service_role USING (true);

-- Inventory Tables
CREATE POLICY authenticated_access_inventory_count_details ON public.inventory_count_details FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_inventory_count_details ON public.inventory_count_details FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_inventory_count_sessions ON public.inventory_count_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_inventory_count_sessions ON public.inventory_count_sessions FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_inventory_items ON public.inventory_items FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_inventory_items ON public.inventory_items FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_inventory_transactions ON public.inventory_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_inventory_transactions ON public.inventory_transactions FOR ALL TO service_role USING (true);

-- Purchase Order Tables
CREATE POLICY authenticated_access_purchase_orders ON public.purchase_orders FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_purchase_orders ON public.purchase_orders FOR ALL TO service_role USING (true);

CREATE POLICY authenticated_access_purchase_order_items ON public.purchase_order_items FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_purchase_order_items ON public.purchase_order_items FOR ALL TO service_role USING (true);

-- Lead Notes
CREATE POLICY authenticated_access_lead_notes ON public.lead_notes FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_lead_notes ON public.lead_notes FOR ALL TO service_role USING (true);

-- Member Individual Insights
CREATE POLICY authenticated_access_member_individual_insights ON public.member_individual_insights FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_individual_insights ON public.member_individual_insights FOR ALL TO service_role USING (true);

-- Member Progress Summary
CREATE POLICY authenticated_access_member_progress_summary ON public.member_progress_summary FOR ALL TO authenticated USING (true);
CREATE POLICY service_role_bypass_member_progress_summary ON public.member_progress_summary FOR ALL TO service_role USING (true);

-- ============================================================================
-- END OF SCHEMA BACKUP
-- ============================================================================
