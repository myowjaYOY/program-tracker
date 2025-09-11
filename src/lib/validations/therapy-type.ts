import { z } from 'zod';

export const therapyTypeSchema = z.object({
  therapy_type_name: z.string().min(1, 'Therapy type name is required'),
  description: z.string().optional().or(z.literal('')),
  active_flag: z.boolean().default(true),
});

export const therapyTypeUpdateSchema = therapyTypeSchema.partial();

export type TherapyTypeFormData = z.infer<typeof therapyTypeSchema>;
export type TherapyTypeUpdateData = z.infer<typeof therapyTypeUpdateSchema> & {
  id: string;
};
