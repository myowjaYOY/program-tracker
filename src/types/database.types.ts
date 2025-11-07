// TODO: Generate this file from Supabase using:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts

// Generated TypeScript types for YOY Program Tracker database
// Based on Supabase schema with 19 tables

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// Enums
export type ScheduleType = 'Therapy' | 'Task';

// Individual table interfaces

export interface Bodies {
  body_id: number;
  body_name: string;
  description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface Buckets {
  bucket_id: number;
  bucket_name: string;
  description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface Campaigns {
  campaign_id: number;
  campaign_name: string;
  campaign_date: string; // ISO string
  description: string;
  confirmed_count: number;
  vendor_id: number;
  ad_spend: number | null;
  food_cost: number | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
  vendor_name?: string | null;
}

export interface Leads {
  lead_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status_id: number | null;
  campaign_id: number | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  pmedate: string | null;
}

export interface MemberProgramItems {
  member_program_item_id: number;
  member_program_id: number | null;
  therapy_id: number | null;
  quantity: number | null;
  item_cost: number | null;
  item_charge: number | null;
  days_from_start: number | null;
  days_between: number | null;
  instructions: string | null;
  program_role_id: number | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // Joined fields from API
  therapy_name?: string | null;
  therapies?: {
    therapy_name: string;
    cost: number | null;
    charge: number | null;
    therapy_type_id: number | null;
    active_flag: boolean;
    therapytype?: {
      therapy_type_name: string;
    };
    buckets?: {
      bucket_name: string;
    };
  } | null;
}

export interface MemberProgramItemTasks {
  member_program_item_task_id: number;
  member_program_item_id: number;
  task_id: number;
  task_name: string;
  description: string | null;
  task_delay: number;
  program_role_id: number; // Role assignment for task (Member, Admin, Coordinator, etc.)
  completed_flag: boolean;
  completed_date: string | null;
  completed_by: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields for joins
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
  completed_by_email?: string | null;
  completed_by_full_name?: string | null;
  therapy_name?: string | null;
  therapy_type_name?: string | null;
}

export interface MemberProgramSchedule {
  program_schedule_id: number;
  member_program_item_id: number | null;
  schedule_type: ScheduleType | null;
  name: string | null;
  instructions: string | null;
  scheduled_date: string | null;
  actual_date: string | null;
  completed: boolean | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface MemberPrograms {
  member_program_id: number;
  program_template_name: string | null;
  description: string | null;
  total_cost: number | null;
  total_charge: number | null;
  final_total_price?: number | null;
  lead_id: number | null;
  start_date: string | null;
  duration: number;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  source_template_id: number | null;
  program_status_id: number | null;
  template_version_date: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
  lead_email?: string | null;
  lead_name?: string | null;
  template_name?: string | null;
  status_name?: string | null;
  // Joined fields from finances table
  margin?: number | null;
}

export interface MemberProgramFinances {
  member_program_finance_id: number;
  member_program_id: number;
  finance_charges: number | null;
  taxes: number | null;
  discounts: number | null;
  final_total_price: number | null;
  margin: number | null;
  financing_type_id: number | null;
  contracted_at_margin: number | null;
  variance: number | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
  financing_type_name?: string | null;
}

export interface MemberProgramPayments {
  member_program_payment_id: number;
  member_program_id: number;
  payment_amount: number | null;
  payment_due_date: string | null;
  payment_date: string | null;
  payment_status_id: number | null;
  payment_method_id: number | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
  payment_status_name?: string | null;
  payment_method_name?: string | null;
}

export interface PaymentStatus {
  payment_status_id: number;
  status_name: string;
  description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
}

export interface PaymentMethods {
  payment_method_id: number;
  method_name: string;
  description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
}

export interface FinancingTypes {
  financing_type_id: number;
  financing_type_name: string;
  description: string | null;
  financing_source: 'internal' | 'external';
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
}

export interface Pillars {
  pillar_id: number;
  pillar_name: string;
  description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface ProgramStatus {
  program_status_id: number;
  status_name: string;
  description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface ProgramRoles {
  program_role_id: number;
  role_name: string;
  description: string | null;
  display_color: string;
  display_order: number;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface ProgramTemplate {
  program_template_id: number;
  program_template_name: string;
  description: string | null;
  total_cost: number | null;
  total_charge: number | null;
  margin_percentage: number | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
}

export interface ProgramTemplateItems {
  program_template_items_id: number;
  program_template_id: number | null;
  therapy_id: number | null;
  quantity: number | null;
  item_cost: number | null;
  item_charge: number | null;
  days_from_start: number | null;
  days_between: number | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ProgramTemplateRasha {
  program_template_rasha_id: number;
  program_template_id: number;
  rasha_list_id: number;
  group_name: string | null;
  type: 'individual' | 'group';
  order_number: number;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields (from joins)
  rasha_name?: string | null;
  rasha_length?: number | null;
}

export interface MemberProgramRasha {
  member_program_rasha_id: number;
  member_program_id: number;
  rasha_list_id: number;
  group_name: string | null;
  type: 'individual' | 'group';
  order_number: number;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields (from joins)
  rasha_name?: string | null;
  rasha_length?: number | null;
}

export interface RashaList {
  rasha_list_id: number;
  name: string;
  length: number;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface Status {
  status_id: number;
  status_name: string;
  description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface Therapies {
  therapy_id: number;
  therapy_name: string;
  description: string | null;
  duration_days: number | null;
  cost: number | null;
  charge: number | null;
  therapy_type_id: number | null;
  bucket_id: number | null;
  program_role_id: number;
  active_flag: boolean;
  taxable: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
  therapy_type_name?: string | null;
  bucket_name?: string | null;
  role_name?: string | null;
  role_display_color?: string | null;
}

export interface TherapiesBodiesPillars {
  therapy_id: number;
  body_id: number;
  pillar_id: number;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields for joined data
  body_name?: string | null;
  pillar_name?: string | null;
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface TherapyTasks {
  task_id: number;
  therapy_id: number;
  task_name: string;
  description: string | null;
  task_delay: number;
  program_role_id: number;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  created_by_full_name?: string | null;
  updated_by_email?: string | null;
  updated_by_full_name?: string | null;
  therapy_name?: string | null;
  role_name?: string | null;
  role_display_color?: string | null;
}

export interface TherapyType {
  therapy_type_id: number;
  therapy_type_name: string;
  description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface Users {
  id: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Vendors {
  vendor_id: number;
  vendor_name: string;
  contact_person: string;
  phone: string;
  email: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface ItemRequest {
  item_request_id: number;
  lead_id: number | null;
  item_description: string;
  quantity: number;
  notes: string | null;
  // Requested stage
  requested_date: string; // ISO timestamp
  requested_by: string; // UUID
  // Ordered stage
  ordered_date: string | null; // ISO timestamp
  ordered_by: string | null; // UUID
  // Received stage
  received_date: string | null; // ISO timestamp
  received_by: string | null; // UUID
  // Cancellation
  is_cancelled: boolean;
  cancelled_date: string | null; // ISO timestamp
  cancelled_by: string | null; // UUID
  cancellation_reason: string | null;
  // Derived/enriched fields (from view or API)
  status?: 'Pending' | 'Ordered' | 'Received' | 'Cancelled';
  status_order?: number;
  requested_by_email?: string | null;
  requested_by_name?: string | null;
  ordered_by_email?: string | null;
  ordered_by_name?: string | null;
  received_by_email?: string | null;
  received_by_name?: string | null;
  cancelled_by_email?: string | null;
  cancelled_by_name?: string | null;
  lead_first_name?: string | null;
  lead_last_name?: string | null;
  member_name?: string | null;
}

export interface PaymentStatus {
  payment_status_id: number;
  payment_status_name: string;
  payment_status_description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface PaymentMethods {
  payment_method_id: number;
  payment_method_name: string;
  payment_method_description: string | null;
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

export interface FinancingTypes {
  financing_type_id: number;
  financing_type_name: string;
  financing_type_description: string | null;
  financing_source: 'internal' | 'external';
  active_flag: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
}

// Main Database interface following Supabase pattern
export interface Database {
  public: {
    Tables: {
      bodies: {
        Row: Bodies;
        Insert: Omit<Bodies, 'body_id'> & { body_id?: number };
        Update: Partial<Omit<Bodies, 'body_id'>>;
      };
      buckets: {
        Row: Buckets;
        Insert: Omit<Buckets, 'bucket_id'> & { bucket_id?: number };
        Update: Partial<Omit<Buckets, 'bucket_id'>>;
      };
      campaigns: {
        Row: Campaigns;
        Insert: Omit<Campaigns, 'campaign_id'> & { campaign_id?: number };
        Update: Partial<Omit<Campaigns, 'campaign_id'>>;
      };
      leads: {
        Row: Leads;
        Insert: Omit<Leads, 'lead_id'> & { lead_id?: number };
        Update: Partial<Omit<Leads, 'lead_id'>>;
      };
      member_program_items: {
        Row: MemberProgramItems;
        Insert: Omit<MemberProgramItems, 'member_program_item_id'> & {
          member_program_item_id?: number;
        };
        Update: Partial<Omit<MemberProgramItems, 'member_program_item_id'>>;
      };
      member_program_item_tasks: {
        Row: MemberProgramItemTasks;
        Insert: Omit<MemberProgramItemTasks, 'member_program_item_task_id'> & {
          member_program_item_task_id?: number;
        };
        Update: Partial<
          Omit<MemberProgramItemTasks, 'member_program_item_task_id'>
        >;
      };
      member_program_schedule: {
        Row: MemberProgramSchedule;
        Insert: Omit<MemberProgramSchedule, 'program_schedule_id'> & {
          program_schedule_id?: number;
        };
        Update: Partial<Omit<MemberProgramSchedule, 'program_schedule_id'>>;
      };
      member_programs: {
        Row: MemberPrograms;
        Insert: Omit<MemberPrograms, 'member_program_id'> & {
          member_program_id?: number;
        };
        Update: Partial<Omit<MemberPrograms, 'member_program_id'>>;
      };
      member_program_finances: {
        Row: MemberProgramFinances;
        Insert: Omit<MemberProgramFinances, 'member_program_finance_id'> & {
          member_program_finance_id?: number;
        };
        Update: Partial<
          Omit<MemberProgramFinances, 'member_program_finance_id'>
        >;
      };
      member_program_payments: {
        Row: MemberProgramPayments;
        Insert: Omit<MemberProgramPayments, 'member_program_payment_id'> & {
          member_program_payment_id?: number;
        };
        Update: Partial<
          Omit<MemberProgramPayments, 'member_program_payment_id'>
        >;
      };
      payment_status: {
        Row: PaymentStatus;
        Insert: Omit<PaymentStatus, 'payment_status_id'> & {
          payment_status_id?: number;
        };
        Update: Partial<Omit<PaymentStatus, 'payment_status_id'>>;
      };
      payment_methods: {
        Row: PaymentMethods;
        Insert: Omit<PaymentMethods, 'payment_method_id'> & {
          payment_method_id?: number;
        };
        Update: Partial<Omit<PaymentMethods, 'payment_method_id'>>;
      };
      financing_types: {
        Row: FinancingTypes;
        Insert: Omit<FinancingTypes, 'financing_type_id'> & {
          financing_type_id?: number;
        };
        Update: Partial<Omit<FinancingTypes, 'financing_type_id'>>;
      };
      pillars: {
        Row: Pillars;
        Insert: Omit<Pillars, 'pillar_id'> & { pillar_id?: number };
        Update: Partial<Omit<Pillars, 'pillar_id'>>;
      };
      program_status: {
        Row: ProgramStatus;
        Insert: Omit<ProgramStatus, 'program_status_id'> & {
          program_status_id?: number;
        };
        Update: Partial<Omit<ProgramStatus, 'program_status_id'>>;
      };
      program_template: {
        Row: ProgramTemplate;
        Insert: Omit<ProgramTemplate, 'program_template_id'> & {
          program_template_id?: number;
        };
        Update: Partial<Omit<ProgramTemplate, 'program_template_id'>>;
      };
      program_template_items: {
        Row: ProgramTemplateItems;
        Insert: Omit<ProgramTemplateItems, 'program_template_items_id'> & {
          program_template_items_id?: number;
        };
        Update: Partial<
          Omit<ProgramTemplateItems, 'program_template_items_id'>
        >;
      };
      status: {
        Row: Status;
        Insert: Omit<Status, 'status_id'> & { status_id?: number };
        Update: Partial<Omit<Status, 'status_id'>>;
      };
      therapies: {
        Row: Therapies;
        Insert: Omit<Therapies, 'therapy_id'> & { therapy_id?: number };
        Update: Partial<Omit<Therapies, 'therapy_id'>>;
      };
      therapies_bodies_pillars: {
        Row: TherapiesBodiesPillars;
        Insert: TherapiesBodiesPillars;
        Update: Partial<TherapiesBodiesPillars>;
      };
      therapy_tasks: {
        Row: TherapyTasks;
        Insert: Omit<TherapyTasks, 'task_id'> & { task_id?: number };
        Update: Partial<Omit<TherapyTasks, 'task_id'>>;
      };
      therapytype: {
        Row: TherapyType;
        Insert: Omit<TherapyType, 'therapy_type_id'> & {
          therapy_type_id?: number;
        };
        Update: Partial<Omit<TherapyType, 'therapy_type_id'>>;
      };
      users: {
        Row: Users;
        Insert: Omit<Users, 'id'> & { id?: string };
        Update: Partial<Omit<Users, 'id'>>;
      };
      vendors: {
        Row: Vendors;
        Insert: Omit<Vendors, 'vendor_id'> & { vendor_id?: number };
        Update: Partial<Omit<Vendors, 'vendor_id'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      schedule_type: ScheduleType;
    };
  };
}

// Common types that might be useful across the application
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

// Inventory Forecast Report Types
export interface InventoryForecastRow {
  id: string | number;               // Required ID for data grid (generated in frontend)
  therapy_type_name: string;
  therapy_name: string;
  therapy_id: number;
  dispensed_count: number;
  owed_count: number;
  total_count: number;
  member_cost: number;               // What members pay (from member_program_items.item_cost)
  current_cost: number;              // Current supplier cost (from therapies.cost)
  quantity_on_hand: number;
  in_inventory: boolean;             // Whether item exists in inventory_items table
}

export interface InventoryForecastMetrics {
  total_cost_owed: number;          // Total cost of all undispensed items
  total_products_owed: number;       // Total count of all undispensed items
  cost_owed_this_month: number;      // Cost of undispensed items scheduled this month
  cost_owed_next_month: number;      // Cost of undispensed items scheduled next month
}

export interface InventoryForecastResponse {
  data: InventoryForecastRow[];
  metrics: InventoryForecastMetrics;
}

// ============================================
// REPORT CARD / SURVEY SCORING TYPES
// ============================================

// MSQ-95 Domain Names (10 symptom categories)
export type MsqDomain =
  | 'head'
  | 'eyes'
  | 'ears'
  | 'nose'
  | 'mouth_throat'
  | 'skin'
  | 'lungs_chest'
  | 'digestive'
  | 'joints_muscles'
  | 'energy_mind_emotions';

// PROMIS-29 domain types (updated for Report Card implementation)
export type PromisDomain =
  | 'physical_function'
  | 'anxiety'
  | 'depression'
  | 'fatigue'
  | 'sleep_disturbance'
  | 'social_roles'
  | 'pain_interference'
  | 'pain_intensity';

/**
 * @deprecated PROMIS-29 removed from Report Card Dashboard (2025-10-18)
 * Kept for historical data access only. Report Card now focuses on MSQ-95 analysis.
 */
export type PromisMilestone = 'baseline' | 'mid' | 'end';

// MSQ-95 Domain Scores (0-4 scale per domain)
export interface MsqDomainScores {
  head: number;
  eyes: number;
  ears: number;
  nose: number;
  mouth_throat: number;
  skin: number;
  lungs_chest: number;
  digestive: number;
  joints_muscles: number;
  energy_mind_emotions: number;
}

/**
 * @deprecated PROMIS-29 removed from Report Card Dashboard (2025-10-18)
 * Kept for historical data access only. Report Card now focuses on MSQ-95 analysis.
 */
export interface PromisTScores {
  physical_function: number;
  anxiety: number;
  depression: number;
  fatigue: number;
  sleep_disturbance: number;
  social_roles: number;
  pain_interference: number;
}

// MSQ-95 Score Record (weekly data point)
export interface MsqScore {
  session_id: number;
  lead_id: number;
  lead_name?: string;
  completed_on: string; // ISO timestamp
  week_number: number;
  total_score: number;
  domain_scores: MsqDomainScores;
  interpretation?: 'optimal' | 'mild' | 'moderate' | 'severe' | 'very_severe';
}

/**
 * @deprecated PROMIS-29 removed from Report Card Dashboard (2025-10-18)
 * Kept for historical data access only. Report Card now focuses on MSQ-95 analysis.
 */
export interface PromisScore {
  session_id: number;
  lead_id: number;
  lead_name?: string;
  completed_on: string; // ISO timestamp
  milestone: PromisMilestone;
  t_scores: PromisTScores;
  pain_intensity: number | null; // 0-10 scale
  overall_mean?: number; // Average of all T-scores
}

// Report Card Summary Metrics (for top 4 cards)
export interface ReportCardSummary {
  total_participants: number;
  participants_with_baseline: number;
  avg_msq_improvement: number; // % change from first to latest
  avg_promis_improvement: number; // T-score change baseline to end
  completion_rate: number; // % of expected surveys completed
  recent_surveys_count: number; // Last 7 days
  recent_surveys_change: number; // % change vs prior 7 days
}

// Participant Filter Option (for dropdowns)
// Uses survey_user_mappings as source (only users with actual survey data)
export interface ParticipantOption {
  external_user_id: number; // Primary identifier from survey system
  lead_id: number | null; // Secondary reference to CRM lead
  first_name: string;
  last_name: string;
  full_name: string;
  survey_count: number; // Count of MSQ-95 surveys completed
  latest_survey_date: string | null;
}

// Program Filter Option (for dropdowns)
export interface ProgramOption {
  program_id: number;
  program_name: string;
  participant_count: number;
  survey_count: number;
}

// Auto-Generated Insights
export interface ReportCardInsight {
  type: 'improvement' | 'stable' | 'worsening' | 'info';
  category: 'msq' | 'promis' | 'overall';
  title: string;
  message: string;
  change_value?: number; // Numeric change (score or %)
  significance?: 'small' | 'moderate' | 'large'; // Clinical significance
}

export interface ReportCardInsights {
  improvements: ReportCardInsight[];
  concerns: ReportCardInsight[];
  stable_areas: ReportCardInsight[];
  summary: string; // Overall narrative summary
}

// Survey Response Data (from database)
export interface SurveyResponse {
  response_id: number;
  session_id: number;
  question_id: number;
  answer_text: string | null;
  answer_numeric: number | null;
  answer_date: string | null;
  answer_boolean: boolean | null;
  created_at: string | null;
  created_by: string | null;
  // Joined fields
  question_text?: string;
  question_order?: number;
  form_id?: number;
  form_name?: string;
}

// Survey Response Session (from database)
export interface SurveyResponseSession {
  session_id: number;
  lead_id: number;
  external_user_id: number | null;
  form_id: number;
  completed_on: string; // ISO timestamp
  import_batch_id: number | null;
  session_status: string | null;
  total_questions: number | null;
  answered_questions: number | null;
  completion_percentage: number | null;
  created_at: string | null;
  created_by: string | null;
  // Joined fields
  form_name?: string;
  form_type?: string;
  lead_first_name?: string;
  lead_last_name?: string;
}

// ============================================
// MSQ CLINICAL DASHBOARD TYPES
// ============================================

// Clinical Alert Types
export type ClinicalAlertType = 'critical' | 'warning' | 'improving';

export interface ClinicalAlert {
  type: ClinicalAlertType;
  icon: string; // Emoji icon (🚨, ⚠️, ✅)
  title: string;
  message: string;
}

// MSQ Assessment Summary (for header section inside MSQ Assessment tab)
export interface MsqAssessmentSummary {
  member_name: string;
  external_user_id: number;
  lead_id: number | null;
  program_name?: string | null;
  period_start: string; // First assessment date
  period_end: string; // Last assessment date
  total_symptoms_count: number; // Total number of unique symptoms (95 max)
  assessment_dates: string[]; // Array of all assessment dates (ISO format)
  
  // 4 Header Cards
  total_msq_score: number; // Latest total MSQ score
  total_score_trend: 'improving' | 'worsening' | 'stable' | 'fluctuating'; // Trend of total MSQ score
  all_total_scores: number[]; // Array of total scores for each assessment
  active_symptoms: number; // Count of symptoms with score > 0
  worsening_count: number; // Count of symptoms that increased (first vs last)
  improving_count: number; // Count of symptoms that decreased (first vs last)
  
  // Clinical Alerts (3 cards)
  clinical_alerts: ClinicalAlert[];
}

// MSQ Domain Card Data
export type DomainTrendType = 'improving' | 'worsening' | 'stable' | 'fluctuating' | 'insufficient_data';
export type SeverityLevel = 'none' | 'mild' | 'moderate' | 'severe';

export interface MsqSymptomProgression {
  symptom_name: string;
  question_text: string;
  scores: number[]; // Array of scores across all assessments (0-4)
  trend: DomainTrendType;
}

export interface MsqDomainCard {
  domain: MsqDomain;
  domain_label: string; // Human-readable (e.g., "Head/Neurological")
  emoji: string; // Domain icon
  average_score: number; // Average of all symptoms in this domain for latest assessment
  severity: SeverityLevel; // Color coding
  trend: DomainTrendType; // Overall domain trend
  trend_description: string; // Human-readable trend (e.g., "Improving - dark circles decreasing")
  symptoms: MsqSymptomProgression[]; // Individual symptoms with progression
  border_color: string; // CSS color for card top border
}

// Food Trigger Categories
export type FoodTriggerPriority = 'high' | 'moderate' | 'consider' | 'safe';

export interface FoodTriggerCategory {
  priority: FoodTriggerPriority;
  title: string; // e.g., "🚨 High Priority"
  foods: string[]; // List of foods with reasoning (e.g., "Dairy products (constipation pattern)")
}

export interface FoodTriggerAnalysis {
  categories: FoodTriggerCategory[];
  explanation: string; // Overall explanation text
}

// Clinical Action Plan (AI-generated)
export type RecommendationType = 'dietary' | 'testing' | 'lifestyle' | 'followup';

export interface ClinicalRecommendation {
  type: RecommendationType;
  title: string;
  description: string;
}

export interface ClinicalActionPlan {
  action_plan: ClinicalRecommendation[]; // Left panel (4 cards)
  progress_monitoring: ClinicalRecommendation[]; // Right panel (4 cards)
  generated_at: string; // Timestamp of AI generation
}

// Complete MSQ Assessment Data (returned by API)
export interface MsqAssessmentData {
  summary: MsqAssessmentSummary;
  domains: MsqDomainCard[];
  food_triggers: FoodTriggerAnalysis;
  clinical_plan: ClinicalActionPlan;
}

// MSQ Interpretation Guide (static content)
export interface MsqInterpretationGuide {
  score_ranges: Array<{
    min: number;
    max: number;
    label: string;
    description: string;
  }>;
  key_patterns: string[];
  patient_profile?: {
    score: number;
    pattern: string;
    primary_system: string;
    prognosis: string;
  };
}

// ============================================
// PROMIS-29 ASSESSMENT TYPES
// ============================================

// PROMIS-29 severity levels (different for symptom vs function domains)
export type PromisSymptomSeverity =
  | 'within_normal'
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'very_severe';

export type PromisFunctionSeverity =
  | 'within_normal'
  | 'mild_limitation'
  | 'moderate_limitation'
  | 'severe_limitation'
  | 'very_severe_limitation';

export type PromisSeverity = PromisSymptomSeverity | PromisFunctionSeverity;

// PROMIS-29 Assessment Summary (for top summary card)
export interface PromisAssessmentSummary {
  member_name: string;
  external_user_id: number;
  lead_id: number | null;
  program_name?: string | null;
  
  // Current assessment (latest)
  current_mean_t_score: number; // Mean of all 7 domain T-scores (excluding pain_intensity)
  current_severity: PromisSymptomSeverity;
  
  // Trend analysis (first to last assessment)
  total_score_trend: DomainTrendType; // 'improving' | 'worsening' | 'stable' | 'fluctuating'
  overall_trend_description: string; // Detailed description with change amount and clinical meaning (for tooltip)
  overall_change_magnitude: string; // 'Minimal Change' | 'Moderate Change' | 'Substantial Change' (for display)
  worsening_domains_count: number;
  improving_domains_count: number;
  
  // Assessment history
  assessment_dates: string[]; // All assessment dates
  all_mean_t_scores: number[]; // Mean T-score for each assessment
  
  // Period info
  period_start: string; // First assessment date
  period_end: string; // Last assessment date
}

// PROMIS-29 Question Progression (for expandable domain cards)
export interface PromisQuestionProgression {
  question_text: string;
  question_order: number;
  all_raw_scores: number[]; // Raw scores (1-5) across all assessments
  all_dates: string[]; // Assessment dates
  trend: DomainTrendType;
}

// PROMIS-29 Domain Card (for domain cards grid)
export interface PromisDomainCard {
  domain_key: PromisDomain;
  domain_label: string; // Human-readable (e.g., "Physical Function")
  emoji: string; // Domain icon
  domain_type: 'symptom' | 'function'; // Determines interpretation direction
  
  // Current assessment (latest)
  current_raw_score: number; // Sum of 4 items (4-20) or single item (0-10 for pain_intensity)
  current_t_score: number | null; // T-score (null for pain_intensity)
  current_severity: PromisSeverity;
  
  // Trend (first to last assessment)
  trend: DomainTrendType;
  trend_description: string; // Human-readable trend
  
  // Historical data
  all_raw_scores: number[]; // Raw scores across all assessments
  all_t_scores: (number | null)[]; // T-scores across all assessments (null for pain_intensity)
  assessment_dates: string[]; // Assessment dates
  
  // Question-level detail (for expanded view)
  questions: PromisQuestionProgression[];
}

// Complete PROMIS-29 Assessment Data (returned by API)
export interface PromisAssessmentData {
  summary: PromisAssessmentSummary;
  domains: PromisDomainCard[];
}

// PROMIS-29 Interpretation Guide (static content)
export interface PromisInterpretationGuide {
  t_score_explanation: string;
  symptom_domains: {
    label: string;
    domains: string[];
    interpretation: string;
    severity_ranges: Array<{
      min: number;
      max: number | null;
      label: string;
      description: string;
    }>;
  };
  function_domains: {
    label: string;
    domains: string[];
    interpretation: string;
    severity_ranges: Array<{
      min: number | null;
      max: number;
      label: string;
      description: string;
    }>;
  };
  clinical_significance: Array<{
    change: number;
    label: string;
    description: string;
  }>;
}
