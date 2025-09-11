import { z } from 'zod';

export const financingTypesSchema = z.object({
  financing_type_name: z.string().min(1, 'Financing type name is required').max(50, 'Financing type name must be 50 characters or less'),
  financing_type_description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  active_flag: z.boolean().default(true),
});

export const financingTypesUpdateSchema = financingTypesSchema.partial();

export type FinancingTypesFormData = z.infer<typeof financingTypesSchema>;
export type FinancingTypesUpdateData = z.infer<typeof financingTypesUpdateSchema>;

