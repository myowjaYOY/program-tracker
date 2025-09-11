import { z } from 'zod';

export const programTemplateSchema = z.object({
  program_template_name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  active_flag: z.boolean().default(true),
});

export const programTemplateUpdateSchema = programTemplateSchema.partial();

export type ProgramTemplateFormData = z.infer<typeof programTemplateSchema>;
export type ProgramTemplateUpdateData = z.infer<typeof programTemplateUpdateSchema>;
