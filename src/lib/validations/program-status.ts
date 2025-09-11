import { z } from 'zod';

export const programStatusSchema = z.object({
  status_name: z.string().min(1, 'Status name is required'),
  description: z.string().optional().or(z.literal('')),
  active_flag: z.boolean().default(true),
});

export const programStatusUpdateSchema = programStatusSchema.partial();

export type ProgramStatusFormData = z.infer<typeof programStatusSchema>;
export type ProgramStatusUpdateData = z.infer<
  typeof programStatusUpdateSchema
> & { id: string };
