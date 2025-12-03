import { z } from 'zod';

// Billing frequency enum for validation
export const billingFrequencyEnum = z.enum(['monthly', 'quarterly', 'annual']);
export type BillingFrequency = z.infer<typeof billingFrequencyEnum>;

/**
 * Schema for membership finances - locked monthly values for membership programs
 * Created at activation, values remain constant for consistent monthly billing
 */
export const memberProgramMembershipFinancesSchema = z.object({
  member_program_id: z.number().min(1, 'Member program ID is required'),
  monthly_rate: z.number()
    .min(0, 'Monthly rate must be non-negative')
    .max(999999.99, 'Monthly rate cannot exceed $999,999.99'),
  monthly_discount: z.number()
    .max(0, 'Monthly discount must be negative or zero')
    .min(-999999.99, 'Monthly discount cannot be less than -$999,999.99')
    .default(0)
    .optional(),
  monthly_tax: z.number()
    .min(0, 'Monthly tax must be non-negative')
    .max(999999.99, 'Monthly tax cannot exceed $999,999.99')
    .default(0)
    .optional(),
  billing_frequency: billingFrequencyEnum.default('monthly'),
});

export const memberProgramMembershipFinancesUpdateSchema = 
  memberProgramMembershipFinancesSchema.partial();

export type MemberProgramMembershipFinancesFormData = z.infer<
  typeof memberProgramMembershipFinancesSchema
>;
export type MemberProgramMembershipFinancesUpdateData = z.infer<
  typeof memberProgramMembershipFinancesUpdateSchema
>;

/**
 * Helper to calculate monthly payment from membership finances
 * Monthly Payment = Monthly Rate + Monthly Discount + Monthly Tax
 * (discount is negative, so adding it subtracts)
 */
export function calculateMonthlyPayment(finances: {
  monthly_rate: number;
  monthly_discount?: number | null;
  monthly_tax?: number | null;
}): number {
  const rate = finances.monthly_rate || 0;
  const discount = finances.monthly_discount || 0;
  const tax = finances.monthly_tax || 0;
  return rate + discount + tax; // discount is negative, so adding it subtracts
}

