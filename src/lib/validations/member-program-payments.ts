import { z } from 'zod';

export const memberProgramPaymentsSchema = z.object({
  member_program_id: z.number().min(1, 'Member program ID is required'),
  payment_amount: z.number().min(0, 'Amount must be non-negative'),
  payment_due_date: z.string().min(1, 'Due date is required'),
  payment_date: z.string().optional().nullable(),
  payment_status_id: z.number().min(1, 'Status is required'),
  payment_method_id: z.number().min(1, 'Method is required'),
  payment_reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Form schema that allows 0 as placeholder but validates on submission
export const memberProgramPaymentsFormSchema = z.object({
  member_program_id: z.number().min(1, 'Member program ID is required'),
  payment_amount: z.number().min(0, 'Amount must be non-negative'),
  payment_due_date: z.string().min(1, 'Due date is required'),
  payment_date: z.string().optional().nullable(),
  payment_status_id: z.number().min(0).refine(val => val > 0, 'Status is required'),
  payment_method_id: z.number().min(0), // Method is optional in form, validated conditionally
  payment_reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const memberProgramPaymentsUpdateSchema =
  memberProgramPaymentsFormSchema.partial();

export type MemberProgramPaymentsFormData = z.infer<
  typeof memberProgramPaymentsFormSchema
>;
export type MemberProgramPaymentsUpdateData = z.infer<
  typeof memberProgramPaymentsUpdateSchema
>;
