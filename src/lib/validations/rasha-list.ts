import { z } from 'zod';

export const rashaListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  length: z
    .number({
      required_error: 'Length is required',
      invalid_type_error: 'Length must be a number',
    })
    .int('Length must be an integer')
    .positive('Length must be a positive number'),
  active_flag: z.boolean().optional(),
});

export type RashaListFormData = z.infer<typeof rashaListSchema>;
export type RashaListUpdateData = Partial<RashaListFormData> & { id: string };

