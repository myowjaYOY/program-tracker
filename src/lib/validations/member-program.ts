import { z } from 'zod';

export const memberProgramSchema = z.object({
  program_template_name: z.string().min(1, 'Program name is required'),
  description: z.string().optional(),
  lead_id: z.number().nullable().optional(),
  start_date: z.string().nullable().optional(),
  program_status_id: z.number().nullable().optional(),
  active_flag: z.boolean().default(true),
});

export const memberProgramUpdateSchema = memberProgramSchema.partial();

export type MemberProgramFormData = z.infer<typeof memberProgramSchema>;
export type MemberProgramUpdateData = z.infer<typeof memberProgramUpdateSchema>;

