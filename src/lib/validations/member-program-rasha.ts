import { z } from 'zod';

export const memberProgramRashaSchema = z.object({
  member_program_id: z.number().int().positive(),
  rasha_list_id: z.number().int().positive('RASHA item is required'),
  group_name: z.string().optional().nullable(),
  type: z.enum(['individual', 'group'], {
    required_error: 'Type is required',
    invalid_type_error: 'Type must be either "individual" or "group"',
  }),
  order_number: z.number().int().nonnegative('Order must be a non-negative number').default(0),
  active_flag: z.boolean().default(true),
});

export const memberProgramRashaUpdateSchema = memberProgramRashaSchema
  .omit({ member_program_id: true })
  .partial();

export type MemberProgramRashaFormData = z.infer<typeof memberProgramRashaSchema>;
export type MemberProgramRashaUpdateData = z.infer<typeof memberProgramRashaUpdateSchema>;

