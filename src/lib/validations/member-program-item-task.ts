import { z } from 'zod';

export const memberProgramItemTaskSchema = z.object({
  member_program_item_id: z
    .number()
    .min(1, 'Member program item ID is required'),
  task_id: z.number().min(0, 'Task ID must be non-negative'),
  task_name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  task_delay: z.number().int('Task delay must be an integer'),
  completed_flag: z.boolean().default(false),
  completed_date: z.string().optional(),
  completed_by: z.string().uuid().optional(),
});

export const memberProgramItemTaskUpdateSchema =
  memberProgramItemTaskSchema.partial();

export type MemberProgramItemTaskFormData = z.infer<
  typeof memberProgramItemTaskSchema
>;
export type MemberProgramItemTaskUpdateData = z.infer<
  typeof memberProgramItemTaskUpdateSchema
>;
