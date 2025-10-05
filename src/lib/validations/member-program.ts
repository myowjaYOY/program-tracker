import { z } from 'zod';

export const memberProgramSchema = z.object({
  program_template_name: z.string().min(1, 'Program Name is required'),
  description: z.string().nullable().optional(),
  lead_id: z.number().nullable().optional(),
  start_date: z.string().nullable().optional(),
  duration: z.number().min(1, 'Duration must be at least 1'),
  program_status_id: z.number().nullable().optional(),
  active_flag: z.boolean().optional(),
});

export const memberProgramUpdateSchema = memberProgramSchema.partial();
export type MemberProgramFormData = z.infer<typeof memberProgramSchema>;
