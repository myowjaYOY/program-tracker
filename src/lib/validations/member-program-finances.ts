import { z } from 'zod';

export const memberProgramFinancesSchema = z.object({
  member_program_id: z.number().min(1, 'Member program ID is required'),
  finance_charges: z.number().min(0, 'Finance charges must be non-negative').optional(),
  taxes: z.number().min(0, 'Taxes must be non-negative').optional(),
  discounts: z.number().min(0, 'Discounts must be non-negative').optional(),
  final_total_price: z.number().min(0, 'Final total price must be non-negative').optional(),
  margin: z.number().optional(),
  financing_type_id: z.number().optional(),
});

export const memberProgramFinancesUpdateSchema = memberProgramFinancesSchema.partial();

export type MemberProgramFinancesFormData = z.infer<typeof memberProgramFinancesSchema>;
export type MemberProgramFinancesUpdateData = z.infer<typeof memberProgramFinancesUpdateSchema>;

