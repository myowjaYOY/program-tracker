import { z } from 'zod';

export const memberProgramFinancesSchema = z.object({
  member_program_id: z.number().min(1, 'Member program ID is required'),
  finance_charges: z.number()
    .min(-999999.99, 'Finance charges cannot be less than -$999,999.99')
    .max(999999.99, 'Finance charges cannot exceed $999,999.99')
    .optional(),
  taxes: z.number()
    .min(0, 'Taxes must be non-negative')
    .max(999999.99, 'Taxes cannot exceed $999,999.99')
    .optional(),
  discounts: z.number()
    .max(0, 'Discounts must be negative')
    .min(-999999.99, 'Discounts cannot be less than -$999,999.99')
    .optional(),
  final_total_price: z
    .number()
    .min(0, 'Final total price must be non-negative')
    .max(9999999.99, 'Final total price cannot exceed $9,999,999.99')
    .optional(),
  margin: z.number()
    .min(-999.99, 'Margin cannot be less than -999.99%')
    .max(999.99, 'Margin cannot exceed 999.99%')
    .optional(),
  financing_type_id: z.number().optional(),
});

export const memberProgramFinancesUpdateSchema =
  memberProgramFinancesSchema.partial();

export type MemberProgramFinancesFormData = z.infer<
  typeof memberProgramFinancesSchema
>;
export type MemberProgramFinancesUpdateData = z.infer<
  typeof memberProgramFinancesUpdateSchema
>;
