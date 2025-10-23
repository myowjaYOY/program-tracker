import { z } from 'zod';

export const programRolesSchema = z.object({
  role_name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name cannot exceed 100 characters'),
  description: z.string().optional().or(z.literal('')),
  display_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Display color must be a valid hex color (e.g., #1976d2)')
    .optional(),
  display_order: z
    .number()
    .int('Display order must be an integer')
    .min(0, 'Display order must be non-negative')
    .optional(),
  active_flag: z.boolean().optional(),
});

// Update schema without defaults to allow partial updates
export const programRolesUpdateSchema = z.object({
  role_name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name cannot exceed 100 characters')
    .optional(),
  description: z.string().optional().or(z.literal('')),
  display_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Display color must be a valid hex color (e.g., #1976d2)')
    .optional(),
  display_order: z
    .number()
    .int('Display order must be an integer')
    .min(0, 'Display order must be non-negative')
    .optional(),
  active_flag: z.boolean().optional(),
});

export type ProgramRolesFormData = z.infer<typeof programRolesSchema>;
export type ProgramRolesUpdateData = z.infer<typeof programRolesUpdateSchema> & {
  id: string;
};

