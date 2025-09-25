import type { Database } from './database.types';

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

// Specific table type helpers
export type Bodies = Tables<'bodies'>;
export type Buckets = Tables<'buckets'>;
export type Campaigns = Tables<'campaigns'>;
export type Leads = Tables<'leads'>;
export type MemberProgramItems = Tables<'member_program_items'>;
export type MemberProgramSchedule = Tables<'member_program_schedule'>;
export type MemberPrograms = Tables<'member_programs'>;
export type Pillars = Tables<'pillars'>;
export type ProgramStatus = Tables<'program_status'>;
export type ProgramTemplate = Tables<'program_template'>;
export type ProgramTemplateItems = Tables<'program_template_items'>;
export type Status = Tables<'status'>;
export type Therapies = Tables<'therapies'>;
export type TherapiesBodiesPillars = Tables<'therapies_bodies_pillars'>;
export type TherapyTasks = Tables<'therapy_tasks'>;
export type TherapyType = Tables<'therapytype'>;
export type Users = Tables<'users'>;
export type Vendors = Tables<'vendors'>;

// Insert type helpers
export type InsertBodies = InsertTables<'bodies'>;
export type InsertBuckets = InsertTables<'buckets'>;
export type InsertCampaigns = InsertTables<'campaigns'>;
export type InsertLeads = InsertTables<'leads'>;
export type InsertMemberProgramItems = InsertTables<'member_program_items'>;
export type InsertMemberProgramSchedule =
  InsertTables<'member_program_schedule'>;
export type InsertMemberPrograms = InsertTables<'member_programs'>;
export type InsertPillars = InsertTables<'pillars'>;
export type InsertProgramStatus = InsertTables<'program_status'>;
export type InsertProgramTemplate = InsertTables<'program_template'>;
export type InsertProgramTemplateItems = InsertTables<'program_template_items'>;
export type InsertStatus = InsertTables<'status'>;
export type InsertTherapies = InsertTables<'therapies'>;
export type InsertTherapiesBodiesPillars =
  InsertTables<'therapies_bodies_pillars'>;
export type InsertTherapyTasks = InsertTables<'therapy_tasks'>;
export type InsertTherapyType = InsertTables<'therapytype'>;
export type InsertUsers = InsertTables<'users'>;
export type InsertVendors = InsertTables<'vendors'>;

// Update type helpers
export type UpdateBodies = UpdateTables<'bodies'>;
export type UpdateBuckets = UpdateTables<'buckets'>;
export type UpdateCampaigns = UpdateTables<'campaigns'>;
export type UpdateLeads = UpdateTables<'leads'>;
export type UpdateMemberProgramItems = UpdateTables<'member_program_items'>;
export type UpdateMemberProgramSchedule =
  UpdateTables<'member_program_schedule'>;
export type UpdateMemberPrograms = UpdateTables<'member_programs'>;
export type UpdatePillars = UpdateTables<'pillars'>;
export type UpdateProgramStatus = UpdateTables<'program_status'>;
export type UpdateProgramTemplate = UpdateTables<'program_template'>;
export type UpdateProgramTemplateItems = UpdateTables<'program_template_items'>;
export type UpdateStatus = UpdateTables<'status'>;
export type UpdateTherapies = UpdateTables<'therapies'>;
export type UpdateTherapiesBodiesPillars =
  UpdateTables<'therapies_bodies_pillars'>;
export type UpdateTherapyTasks = UpdateTables<'therapy_tasks'>;
export type UpdateTherapyType = UpdateTables<'therapytype'>;
export type UpdateUsers = UpdateTables<'users'>;
export type UpdateVendors = UpdateTables<'vendors'>;
