import { z } from 'zod';

export const therapySchema = z.object({
  therapy_name: z.string().min(1, 'Therapy name is required'),
  description: z.string().optional().or(z.literal('')),
  therapy_type_id: z.number().min(1, 'Therapy type is required'),
  bucket_id: z.number().min(1, 'Bucket is required'),
  cost: z.number().min(0, 'Cost must be a positive number'),
  charge: z.number().min(0, 'Charge must be a positive number'),
  active_flag: z.boolean(),
  taxable: z.boolean(),
});

export const therapyUpdateSchema = therapySchema.partial();

export type TherapyFormData = z.infer<typeof therapySchema>;
export type TherapyUpdateData = z.infer<typeof therapyUpdateSchema> & {
  id: string;
};
