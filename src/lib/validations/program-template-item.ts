import { z } from 'zod';

export const programTemplateItemSchema = z.object({
  therapy_type_id: z.number().min(1, 'Therapy type is required'),
  therapy_id: z.number().min(1, 'Therapy is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  days_from_start: z.number().min(0, 'Days from start cannot be negative'),
  days_between: z.number().min(0, 'Days between cannot be negative'),
  active_flag: z.boolean().default(true),
  instructions: z.string().optional(),
});

export const programTemplateItemUpdateSchema = programTemplateItemSchema.partial();

export type ProgramTemplateItemFormData = z.infer<typeof programTemplateItemSchema>;
export type ProgramTemplateItemUpdateData = z.infer<typeof programTemplateItemUpdateSchema>;
