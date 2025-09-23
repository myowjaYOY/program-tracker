import { z } from 'zod';

export const paymentStatusSchema = z.object({
  payment_status_name: z
    .string()
    .min(1, 'Payment status name is required')
    .max(50, 'Payment status name must be 50 characters or less'),
  payment_status_description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  active_flag: z.boolean().default(true),
});

export const paymentStatusUpdateSchema = paymentStatusSchema.partial();

export type PaymentStatusFormData = z.infer<typeof paymentStatusSchema>;
export type PaymentStatusUpdateData = z.infer<typeof paymentStatusUpdateSchema>;
