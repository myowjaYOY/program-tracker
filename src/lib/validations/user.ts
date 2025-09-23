import { z } from 'zod';

export const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  is_admin: z.boolean().default(false),
  is_active: z.boolean().default(false),
});

export const userUpdateSchema = userSchema.partial().omit({ password: true });

export const userPasswordUpdateSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .optional(),
});

export const userPermissionsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  menuPaths: z.array(z.string()),
});

export type UserFormData = z.infer<typeof userSchema>;
export type UserUpdateData = z.infer<typeof userUpdateSchema>;
export type UserPermissionsData = z.infer<typeof userPermissionsSchema>;
