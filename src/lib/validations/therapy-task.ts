import { z } from 'zod';

export const therapyTaskSchema = z.object({
  task_name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  therapy_id: z.number().int().positive('Therapy ID must be a positive integer'),
  task_delay: z.number().int('Task delay must be an integer'),
  active_flag: z.boolean().default(true),
});

export const therapyTaskUpdateSchema = therapyTaskSchema.partial();

export type TherapyTaskFormData = z.infer<typeof therapyTaskSchema>;
export type TherapyTaskUpdateData = z.infer<typeof therapyTaskUpdateSchema>;


