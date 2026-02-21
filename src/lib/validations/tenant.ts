import { z } from 'zod';

export const tenantSchema = z.object({
    tenant_name: z
        .string()
        .min(2, 'Tenant name must be at least 2 characters')
        .max(100, 'Tenant name must be less than 100 characters'),
    tenant_slug: z
        .string()
        .min(2, 'Slug must be at least 2 characters')
        .max(50, 'Slug must be less than 50 characters')
        .regex(
            /^[a-z0-9-]+$/,
            'Slug must be lowercase alphanumeric with hyphens only'
        ),
    is_active: z.boolean().default(true),
    subscription_tier: z
        .enum(['standard', 'professional', 'enterprise'])
        .default('standard'),
    contact_email: z
        .string()
        .email('Must be a valid email')
        .nullable()
        .optional(),
    contact_name: z
        .string()
        .max(100)
        .nullable()
        .optional(),
    max_users: z
        .number()
        .int()
        .min(1, 'Must allow at least 1 user')
        .max(10000)
        .default(50),
});

export const tenantUpdateSchema = tenantSchema.partial();

export type TenantFormData = z.infer<typeof tenantSchema>;
export type TenantUpdateData = z.infer<typeof tenantUpdateSchema>;