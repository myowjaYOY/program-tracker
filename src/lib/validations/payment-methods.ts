import { z } from 'zod';

export const paymentMethodsSchema = z.object({
  payment_method_name: z.string().min(1, 'Payment method name is required').max(50, 'Payment method name must be 50 characters or less'),
  payment_method_description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  active_flag: z.boolean().default(true),
});

export const paymentMethodsUpdateSchema = paymentMethodsSchema.partial();

export type PaymentMethodsFormData = z.infer<typeof paymentMethodsSchema>;
export type PaymentMethodsUpdateData = z.infer<typeof paymentMethodsUpdateSchema>;

