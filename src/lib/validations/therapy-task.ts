import { z } from 'zod';

// Form schema includes therapy_type_id for UI filtering (not stored in DB)
export const therapyTaskFormSchema = z.object({
  therapy_type_id: z
    .number()
    .int()
    .positive('Therapy type is required'),
  therapy_id: z
    .number()
    .int()
    .positive('Therapy ID must be a positive integer'),
  task_name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  task_delay: z.number().int('Task delay must be an integer'),
  active_flag: z.boolean().default(true),
});

// API schema excludes therapy_type_id (not stored in therapy_tasks table)
export const therapyTaskSchema = z.object({
  therapy_id: z
    .number()
    .int()
    .positive('Therapy ID must be a positive integer'),
  task_name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  task_delay: z.number().int('Task delay must be an integer'),
  active_flag: z.boolean().default(true),
});

export const therapyTaskUpdateSchema = therapyTaskSchema.partial();

export type TherapyTaskFormData = z.infer<typeof therapyTaskFormSchema>;
export type TherapyTaskAPIData = z.infer<typeof therapyTaskSchema>;
export type TherapyTaskUpdateData = z.infer<typeof therapyTaskUpdateSchema>;
