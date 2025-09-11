import { z } from 'zod';

export const bodySchema = z.object({
  body_name: z.string().min(1, 'Body name is required'),
  description: z.string().optional().or(z.literal('')),
  active_flag: z.boolean().default(true),
});

export const bodyUpdateSchema = bodySchema.partial();

export type BodyFormData = z.infer<typeof bodySchema>;
export type BodyUpdateData = z.infer<typeof bodyUpdateSchema> & { id: string };
