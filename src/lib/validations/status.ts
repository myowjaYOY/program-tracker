import { z } from 'zod';

export const statusSchema = z.object({
  status_name: z.string().min(1, 'Status name is required'),
  description: z.string().optional().or(z.literal('')),
  active_flag: z.boolean().default(true),
});

export const statusUpdateSchema = statusSchema.partial();

export type StatusFormData = z.infer<typeof statusSchema>;
export type StatusUpdateData = z.infer<typeof statusUpdateSchema> & {
  id: string;
};
