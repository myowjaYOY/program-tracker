import { z } from 'zod';

export const memberProgramItemSchema = z.object({
  therapy_type_id: z.number().min(1, 'Therapy type is required').optional(),
  therapy_id: z.number().min(1, 'Therapy is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  days_from_start: z.number().min(0, 'Days from start cannot be negative'),
  days_between: z.number().min(0, 'Days between cannot be negative'),
  instructions: z.string().optional(),
});

export const memberProgramItemUpdateSchema = memberProgramItemSchema.partial();

export type MemberProgramItemFormData = z.infer<typeof memberProgramItemSchema>;
export type MemberProgramItemUpdateData = z.infer<
  typeof memberProgramItemUpdateSchema
>;
