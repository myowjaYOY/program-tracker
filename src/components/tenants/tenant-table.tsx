'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Box, Chip, Typography } from '@mui/material';
import {
    Business as BusinessIcon,
} from '@mui/icons-material';
import BaseDataTable, {
    commonColumns,
    renderDateTime,
} from '@/components/tables/base-data-table';
import TenantForm from '@/components/forms/tenant-form';
import { useTenants, useDeactivateTenant, TenantWithUsers } from '@/lib/hooks/use-tenants';
import { TenantFormData } from '@/lib/validations/tenant';

interface TenantEntity extends TenantWithUsers {
    id: string;
}

const TIER_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
    standard: 'default',
    professional: 'primary',
    enterprise: 'warning',
};

const tenantColumns: GridColDef[] = [
    {
        field: 'tenant_name',
        headerName: 'Organization',
        width: 220,
        flex: 1,
        renderCell: (params) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon fontSize="small" color="action" />
                <Typography variant="body2" fontWeight={500}>
                    {params.value}
                </Typography>
            </Box>
        ),
    },
    {
        field: 'tenant_slug',
        headerName: 'Slug',
        width: 140,
        renderCell: (params) => (
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                {params.value}
            </Typography>
        ),
    },
    {
        field: 'subscription_tier',
        headerName: 'Tier',
        width: 130,
        renderCell: (params) => (
            <Chip
                label={params.value?.charAt(0).toUpperCase() + params.value?.slice(1)}
                color={TIER_COLORS[params.value as string] || 'default'}
                size="small"
            />
        ),
    },
    {
        field: 'user_count',
        headerName: 'Users',
        width: 100,
        type: 'number',
        renderCell: (params) => {
            const max = params.row.max_users;
            const count = params.value || 0;
            return (
                <Typography
                    variant="body2"
                    color={count >= max ? 'error.main' : 'text.primary'}
                >
                    {count} / {max}
                </Typography>
            );
        },
    },
    {
        field: 'contact_email',
        headerName: 'Contact',
        width: 200,
        renderCell: (params) => params.value || '-',
    },
    {
        field: 'is_active',
        headerName: 'Status',
        width: 100,
        renderCell: (params) => (
            <Chip
                label={params.value ? 'Active' : 'Inactive'}
                color={params.value ? 'success' : 'default'}
                size="small"
            />
        ),
    },
    {
        field: 'created_at',
        headerName: 'Created',
        width: 170,
        renderCell: renderDateTime,
    },
];

export default function TenantTable() {
    const { data: tenants, isLoading, error } = useTenants();
    const deactivateTenant = useDeactivateTenant();

    const handleDelete = (id: string | number) => {
        deactivateTenant.mutate(String(id));
    };

    const handleEdit = (_row: TenantEntity) => {
        // Edit handled by BaseDataTable modal
    };

    const renderTenantForm = ({
        open,
        onClose,
        initialValues,
        mode,
    }: {
        open: boolean;
        onClose: () => void;
        initialValues?: Partial<TenantEntity>;
        mode: 'create' | 'edit';
    }) => {
        if (!open) return null;

        const formData: Partial<TenantFormData> & { tenant_id?: string } =
            initialValues
                ? {
                    tenant_name: initialValues.tenant_name || '',
                    tenant_slug: initialValues.tenant_slug || '',
                    is_active: initialValues.is_active ?? true,
                    subscription_tier:
                        (initialValues.subscription_tier as TenantFormData['subscription_tier']) ||
                        'standard',
                    contact_email: initialValues.contact_email || '',
                    contact_name: initialValues.contact_name || '',
                    max_users: initialValues.max_users || 50,
                    ...(initialValues.tenant_id && {
                        tenant_id: initialValues.tenant_id,
                    }),
                }
                : {};

        return (
            <TenantForm initialValues={formData} onSuccess={onClose} mode={mode} />
        );
    };

    const tenantsWithId: TenantEntity[] = (tenants || []).map((tenant) => ({
        ...tenant,
        id: tenant.tenant_id,
    }));

    return (
        <BaseDataTable<TenantEntity>
            title="Tenant Management"
            data={tenantsWithId}
            columns={tenantColumns}
            loading={isLoading}
            error={error?.message || null}
            getRowId={(row) => row.tenant_id}
            onEdit={handleEdit}
            onDelete={handleDelete}
            renderForm={renderTenantForm}
            persistStateKey="tenantsGrid"
            createButtonText="Add Tenant"
            editButtonText="Edit Tenant"
            deleteButtonText="Deactivate Tenant"
            deleteConfirmMessage="Are you sure you want to deactivate this tenant? Users will lose access, but data will be preserved."
            pageSize={25}
            pageSizeOptions={[10, 25, 50]}
        />
    );
}