import { z } from 'zod';

export const programTemplateItemSchema = z.object({
  therapy_type_id: z.number().min(1, 'Therapy type is required'),
  therapy_id: z.number().min(1, 'Therapy is required'),
  quantity: z.number()
    .min(1, 'Quantity must be at least 1')
    .max(100000, 'Quantity cannot exceed 100,000'),
  days_from_start: z.number()
    .min(0, 'Days from start cannot be negative')
    .max(3650, 'Days from start cannot exceed 3,650 (10 years)'),
  days_between: z.number()
    .min(0, 'Days between cannot be negative')
    .max(365, 'Days between cannot exceed 365'),
  active_flag: z.boolean().default(true),
  instructions: z.string()
    .max(1000, 'Instructions cannot exceed 1,000 characters')
    .optional(),
});

export const programTemplateItemUpdateSchema =
  programTemplateItemSchema.partial();

export type ProgramTemplateItemFormData = z.infer<
  typeof programTemplateItemSchema
>;
export type ProgramTemplateItemUpdateData = z.infer<
  typeof programTemplateItemUpdateSchema
>;
