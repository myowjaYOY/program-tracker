import { z } from 'zod';

export const campaignSchema = z.object({
  campaign_name: z.string().min(1, 'Campaign name is required'),
  campaign_date: z.string().min(1, 'Campaign date is required'), // ISO string
  description: z.string().min(1, 'Description is required'),
  confirmed_count: z.number({
    invalid_type_error: 'Confirmed count is required',
  }),
  vendor_id: z.number({ invalid_type_error: 'Vendor is required' }),
  ad_spend: z.number().nullable().optional(),
  food_cost: z.number().nullable().optional(),
  active_flag: z.boolean(),
});

export const campaignUpdateSchema = campaignSchema.partial();

export type CampaignFormData = z.infer<typeof campaignSchema>;
export type CampaignUpdateData = z.infer<typeof campaignUpdateSchema> & {
  id: string;
};
