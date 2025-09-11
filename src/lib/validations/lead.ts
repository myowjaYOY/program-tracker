import { z } from 'zod';

export const leadSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
  status_id: z.number().min(1, 'Status is required'),
  campaign_id: z.number().min(1, 'Campaign is required'),
  pmedate: z.string().optional().or(z.literal('')),
  active_flag: z.boolean(),
});

export const leadUpdateSchema = leadSchema.partial();

export type LeadFormData = z.infer<typeof leadSchema>;
export type LeadUpdateData = z.infer<typeof leadUpdateSchema> & { id: string };
