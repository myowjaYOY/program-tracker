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
  active_flag: boolean;
  taxable: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // API-mapped fields
  created_by_email?: string | null;
  updated_by_email?: string | null;
  therapy_type_name?: string | null;
  bucket_name?: string | null;
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
  dispensed_count: number;
  owed_count: number;
  total_count: number;
  item_cost: number;
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
