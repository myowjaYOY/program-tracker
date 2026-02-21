'use client';

import React from 'react';
import {
    Box,
    TextField,
    MenuItem,
    FormControlLabel,
    Switch,
    Button,
    CircularProgress,
    DialogActions,
    DialogContent,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tenantSchema, TenantFormData } from '@/lib/validations/tenant';
import { useCreateTenant, useUpdateTenant } from '@/lib/hooks/use-tenants';

interface TenantFormProps {
    initialValues?: Partial<TenantFormData> & { tenant_id?: string };
    onSuccess: () => void;
    mode: 'create' | 'edit';
}

const SUBSCRIPTION_TIERS = [
    { value: 'standard', label: 'Standard' },
    { value: 'professional', label: 'Professional' },
    { value: 'enterprise', label: 'Enterprise' },
];

export default function TenantForm({
    initialValues,
    onSuccess,
    mode,
}: TenantFormProps) {
    const createTenant = useCreateTenant();
    const updateTenant = useUpdateTenant();
    const isSubmitting = createTenant.isPending || updateTenant.isPending;

    const {
        control,
        handleSubmit,
        formState: { errors },
        watch,
        setValue,
    } = useForm<TenantFormData>({
        resolver: zodResolver(tenantSchema),
        defaultValues: {
            tenant_name: initialValues?.tenant_name || '',
            tenant_slug: initialValues?.tenant_slug || '',
            is_active: initialValues?.is_active ?? true,
            subscription_tier: initialValues?.subscription_tier || 'standard',
            contact_email: initialValues?.contact_email || '',
            contact_name: initialValues?.contact_name || '',
            max_users: initialValues?.max_users || 50,
        },
    });

    // Auto-generate slug from name (only in create mode)
    const tenantName = watch('tenant_name');
    React.useEffect(() => {
        if (mode === 'create' && tenantName) {
            const slug = tenantName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            setValue('tenant_slug', slug, { shouldValidate: true });
        }
    }, [tenantName, mode, setValue]);

    const onSubmit = async (data: TenantFormData) => {
        try {
            if (mode === 'edit' && initialValues?.tenant_id) {
                await updateTenant.mutateAsync({
                    id: initialValues.tenant_id,
                    data,
                });
            } else {
                await createTenant.mutateAsync(data);
            }
            onSuccess();
        } catch {
            // Error handled by mutation hooks
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <Controller
                        name="tenant_name"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                label="Organization Name"
                                error={!!errors.tenant_name}
                                helperText={errors.tenant_name?.message}
                                fullWidth
                                required
                            />
                        )}
                    />

                    <Controller
                        name="tenant_slug"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                label="URL Slug"
                                error={!!errors.tenant_slug}
                                helperText={
                                    errors.tenant_slug?.message ||
                                    `Access URL: ${field.value || 'slug'}.yourdomain.com`
                                }
                                fullWidth
                                required
                                disabled={mode === 'edit'}
                            />
                        )}
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Controller
                            name="contact_name"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    value={field.value || ''}
                                    label="Contact Name"
                                    error={!!errors.contact_name}
                                    helperText={errors.contact_name?.message}
                                    fullWidth
                                />
                            )}
                        />

                        <Controller
                            name="contact_email"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    value={field.value || ''}
                                    label="Contact Email"
                                    error={!!errors.contact_email}
                                    helperText={errors.contact_email?.message}
                                    fullWidth
                                />
                            )}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Controller
                            name="subscription_tier"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    select
                                    label="Subscription Tier"
                                    error={!!errors.subscription_tier}
                                    helperText={errors.subscription_tier?.message}
                                    fullWidth
                                >
                                    {SUBSCRIPTION_TIERS.map((tier) => (
                                        <MenuItem key={tier.value} value={tier.value}>
                                            {tier.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                        />

                        <Controller
                            name="max_users"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    label="Max Users"
                                    type="number"
                                    error={!!errors.max_users}
                                    helperText={errors.max_users?.message}
                                    fullWidth
                                    inputProps={{ min: 1, max: 10000 }}
                                />
                            )}
                        />
                    </Box>

                    {mode === 'edit' && (
                        <Controller
                            name="is_active"
                            control={control}
                            render={({ field }) => (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={field.value}
                                            onChange={field.onChange}
                                            color="success"
                                        />
                                    }
                                    label={field.value ? 'Active' : 'Inactive'}
                                />
                            )}
                        />
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onSuccess} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting}
                    startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
                >
                    {isSubmitting
                        ? 'Saving...'
                        : mode === 'create'
                            ? 'Create Tenant'
                            : 'Update Tenant'}
                </Button>
            </DialogActions>
        </form>
    );
}