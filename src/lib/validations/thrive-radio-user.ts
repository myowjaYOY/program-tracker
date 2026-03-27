import { z } from 'zod';

export const addThriveRadioUserSchema = z.object({
  person_id: z.union([z.string(), z.number()]),
  person_type: z.enum(['lead', 'employee']),
});

export type AddThriveRadioUserData = z.infer<typeof addThriveRadioUserSchema>;
