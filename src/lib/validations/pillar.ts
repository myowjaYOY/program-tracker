import { z } from 'zod';

export const pillarSchema = z.object({
  pillar_name: z.string().min(1, 'Pillar name is required'),
  description: z.string().optional().or(z.literal('')),
  active_flag: z.boolean().default(true),
});

export const pillarUpdateSchema = pillarSchema.partial();

export type PillarFormData = z.infer<typeof pillarSchema>;
export type PillarUpdateData = z.infer<typeof pillarUpdateSchema> & {
  id: string;
};
