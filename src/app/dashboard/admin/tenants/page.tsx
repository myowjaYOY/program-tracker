'use client';

import React, { useState, useEffect } from 'react';
import TenantUsersTable from '@/components/admin/tenant-users-table';
import {
    Box,
    Typography,
    Button,
    Grid,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    IconButton,
    Chip,
    Divider,
    Paper,
    Drawer,
    Alert,
    Tooltip,
    Card,
    CardContent,
    Select,
    MenuItem,
    SelectChangeEvent,
} from '@mui/material';
import {
    Add as AddIcon,
    Close as CloseIcon,
    Business as BusinessIcon,
    People as PeopleIcon,
    Settings as SettingsIcon,
    SwapHoriz as SwapIcon,
    Refresh as RefreshIcon,
    History as HistoryIcon,
    Shield as ShieldIcon,
    ExitToApp as ExitIcon,
    Block as InactiveIcon,
    CheckCircle as ActiveIcon,
    Edit as EditIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import { GridColDef, GridActionsCellItem } from '@mui/x-data-grid-pro';
import BaseDataTable from '@/components/tables/base-data-table';
import {
    tenantAdminKeys,
    useTenants,
    useTenantDetail,
    useCreateTenant,
    useUpdateTenant,
    useSwitchTenantContext,
    useClearTenantContext,
    useAdminAuditLog,
    useTenantContext,
    type Tenant,
    type CreateTenantData,
} from '@/lib/hooks/use-tenant-admin';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUserPermissions } from '@/lib/hooks/use-user-permissions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { TenantFormData } from '@/lib/validations/tenant';

// ─── Create Tenant Dialog ────────────────────────────────────────────────────

interface CreateTenantDialogProps {
    open: boolean;
    onClose: () => void;
}

function CreateTenantDialog({ open, onClose }: CreateTenantDialogProps) {
    const createTenant = useCreateTenant();
    const [form, setForm] = useState<CreateTenantData>({
        tenant_name: '',
        tenant_slug: '',
        subscription_tier: 'standard',
        contact_email: '',
        contact_name: '',
        max_users: 50,
    });

    const handleSlugify = (name: string) => {
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        setForm((prev) => ({ ...prev, tenant_name: name, tenant_slug: slug }));
    };

    const handleSubmit = async () => {
        if (!form.tenant_name || !form.tenant_slug) {
            toast.error('Name and slug are required');
            return;
        }
        try {
            await createTenant.mutateAsync(form);
            onClose();
            setForm({
                tenant_name: '',
                tenant_slug: '',
                subscription_tier: 'standard',
                contact_email: '',
                contact_name: '',
                max_users: 50,
            });
        } catch {
            // Error handled by hook
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Create New Tenant
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label="Organization Name"
                        value={form.tenant_name}
                        onChange={(e) => handleSlugify(e.target.value)}
                        fullWidth
                        required
                    />
                    <TextField
                        label="Slug (subdomain)"
                        value={form.tenant_slug}
                        onChange={(e) => setForm((prev) => ({ ...prev, tenant_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                        fullWidth
                        required
                        helperText={form.tenant_slug ? `${form.tenant_slug}.yourdomain.com` : 'Auto-generated from name'}
                    />
                    <TextField
                        label="Subscription Tier"
                        select
                        value={form.subscription_tier}
                        onChange={(e) => setForm((prev) => ({ ...prev, subscription_tier: e.target.value }))}
                        fullWidth
                    >
                        <MenuItem value="standard">Standard</MenuItem>
                        <MenuItem value="professional">Professional</MenuItem>
                        <MenuItem value="enterprise">Enterprise</MenuItem>
                    </TextField>
                    <Grid container spacing={2}>
                        <Grid size={6}>
                            <TextField
                                label="Contact Name"
                                value={form.contact_name}
                                onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                                fullWidth
                            />
                        </Grid>
                        <Grid size={6}>
                            <TextField
                                label="Contact Email"
                                value={form.contact_email}
                                onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                                fullWidth
                            />
                        </Grid>
                    </Grid>
                    <TextField
                        label="Max Users"
                        type="number"
                        value={form.max_users}
                        onChange={(e) => setForm((prev) => ({ ...prev, max_users: parseInt(e.target.value) || 50 }))}
                        fullWidth
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={createTenant.isPending || !form.tenant_name || !form.tenant_slug}
                    startIcon={createTenant.isPending ? <CircularProgress size={16} /> : <AddIcon />}
                    sx={{ borderRadius: 0, fontWeight: 600 }}
                >
                    Create Tenant
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Tenant Detail Drawer ────────────────────────────────────────────────────

interface TenantDetailDrawerProps {
    tenantId: string | null;
    open: boolean;
    onClose: () => void;
}

function TenantDetailDrawer({ tenantId, open, onClose }: TenantDetailDrawerProps) {
    const { data, isLoading } = useTenantDetail(tenantId);
    const updateTenant = useUpdateTenant();
    const switchContext = useSwitchTenantContext();

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<TenantFormData>>({});

    // Reset edit state when drawer closes or tenant changes
    useEffect(() => {
        if (!open) {
            setIsEditing(false);
        }
    }, [open]);

    useEffect(() => {
        if (data?.tenant) {
            setEditForm({
                tenant_name: data.tenant.tenant_name,
                contact_name: data.tenant.contact_name,
                contact_email: data.tenant.contact_email,
                subscription_tier: data.tenant.subscription_tier as any,
                max_users: data.tenant.max_users,
            });
        }
    }, [data?.tenant]);

    const handleSave = () => {
        if (!tenantId) return;

        const updateData: Partial<Tenant> = {};
        if (editForm.tenant_name !== undefined) updateData.tenant_name = editForm.tenant_name;
        if (editForm.contact_name !== undefined) updateData.contact_name = editForm.contact_name;
        if (editForm.contact_email !== undefined) updateData.contact_email = editForm.contact_email;
        if (editForm.subscription_tier !== undefined) updateData.subscription_tier = editForm.subscription_tier;
        if (editForm.max_users !== undefined) updateData.max_users = editForm.max_users;

        updateTenant.mutate(
            { tenantId, data: updateData },
            {
                onSuccess: () => {
                    setIsEditing(false);
                },
            }
        );
    };

    if (!tenantId) return null;

    const tenant = data?.tenant;
    const users = data?.users || [];
    const stats = data?.stats || {};

    return (
        <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}>
            <Box sx={{ p: 3 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" fontWeight={600}>
                        Tenant Details
                    </Typography>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : tenant ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Name & Status */}
                        <Box>
                            {isEditing ? (
                                <TextField
                                    label="Tenant Name"
                                    value={editForm.tenant_name || ''}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setEditForm((prev: Partial<TenantFormData>) => ({ ...prev, tenant_name: e.target.value }))}
                                    fullWidth
                                    size="small"
                                    sx={{ mb: 2 }}
                                />
                            ) : (
                                <Typography variant="h6" fontWeight={600}>
                                    {tenant.tenant_name}
                                </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary">
                                {tenant.tenant_slug}.yourdomain.com
                            </Typography>
                            <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Chip
                                    label={tenant.is_active ? 'Active' : 'Inactive'}
                                    color={tenant.is_active ? 'success' : 'default'}
                                    size="small"
                                />
                                {isEditing ? (
                                    <Select
                                        size="small"
                                        value={editForm.subscription_tier || 'standard'}
                                        onChange={(e: SelectChangeEvent<any>) => setEditForm((prev: Partial<TenantFormData>) => ({ ...prev, subscription_tier: e.target.value as any }))}
                                        sx={{ height: 24, fontSize: '0.75rem' }}
                                    >
                                        <MenuItem value="standard">Standard</MenuItem>
                                        <MenuItem value="professional">Professional</MenuItem>
                                        <MenuItem value="enterprise">Enterprise</MenuItem>
                                    </Select>
                                ) : (
                                    <Chip label={tenant.subscription_tier} size="small" variant="outlined" />
                                )}
                            </Box>
                        </Box>

                        <Divider />

                        {/* Stats */}
                        <Grid container spacing={2}>
                            {Object.entries(stats).map(([key, value]) => (
                                <Grid size={6} key={key}>
                                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="h5" fontWeight={700} color="primary.main">
                                            {value}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                            {key.replace(/_/g, ' ')}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>

                        <Divider />

                        {/* Contact */}
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Contact
                            </Typography>
                            {isEditing ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                                    <TextField
                                        label="Contact Name"
                                        value={editForm.contact_name || ''}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setEditForm((prev: Partial<TenantFormData>) => ({ ...prev, contact_name: e.target.value }))}
                                        fullWidth
                                        size="small"
                                    />
                                    <TextField
                                        label="Contact Email"
                                        value={editForm.contact_email || ''}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setEditForm((prev: Partial<TenantFormData>) => ({ ...prev, contact_email: e.target.value }))}
                                        fullWidth
                                        size="small"
                                    />
                                </Box>
                            ) : (
                                <>
                                    <Typography variant="body2">{tenant.contact_name || '—'}</Typography>
                                    <Typography variant="body2" color="text.secondary">{tenant.contact_email || '—'}</Typography>
                                </>
                            )}
                        </Box>

                        <Divider />

                        {/* Users */}
                        <TenantUsersTable
                            tenantId={tenantId}
                            tenantName={tenant.tenant_name}
                        />
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Users ({users.length} / {isEditing ? '-' : tenant.max_users})
                                </Typography>
                                {isEditing && (
                                    <TextField
                                        label="Max Users"
                                        type="number"
                                        value={editForm.max_users || 0}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setEditForm((prev: Partial<TenantFormData>) => ({ ...prev, max_users: parseInt(e.target.value) || 0 }))}
                                        size="small"
                                        sx={{ width: 100 }}
                                    />
                                )}
                            </Box>
                            {users.map((user) => (
                                <Box key={user.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}>
                                    <Box>
                                        <Typography variant="body2" fontWeight={500}>
                                            {user.full_name || user.email}
                                        </Typography>
                                        {user.full_name && (
                                            <Typography variant="caption" color="text.secondary">
                                                {user.email}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        {user.is_super_admin && <Chip label="Super" size="small" color="error" />}
                                        {user.is_admin && <Chip label="Admin" size="small" color="primary" />}
                                        <Chip
                                            label={user.is_active ? 'Active' : 'Inactive'}
                                            size="small"
                                            color={user.is_active ? 'success' : 'default'}
                                            variant="outlined"
                                        />
                                    </Box>
                                </Box>
                            ))}
                        </Box>

                        <Divider />

                        {/* Actions */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {isEditing ? (
                                <>
                                    <Button
                                        variant="contained"
                                        onClick={handleSave}
                                        disabled={updateTenant.isPending}
                                        startIcon={updateTenant.isPending ? <CircularProgress size={16} /> : <SaveIcon />}
                                        sx={{ borderRadius: 0, fontWeight: 600 }}
                                    >
                                        Save Changes
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => setIsEditing(false)}
                                        disabled={updateTenant.isPending}
                                        sx={{ borderRadius: 0 }}
                                    >
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="outlined"
                                        startIcon={<EditIcon />}
                                        onClick={() => setIsEditing(true)}
                                        sx={{ borderRadius: 0, fontWeight: 600 }}
                                    >
                                        Edit Details
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<SwapIcon />}
                                        onClick={() => {
                                            switchContext.mutate(tenantId);
                                            onClose();
                                        }}
                                        disabled={switchContext.isPending}
                                        sx={{ borderRadius: 0, fontWeight: 600 }}
                                    >
                                        Switch Into This Tenant
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color={tenant.is_active ? 'error' : 'success'}
                                        startIcon={tenant.is_active ? <InactiveIcon /> : <ActiveIcon />}
                                        onClick={() => {
                                            updateTenant.mutate({
                                                tenantId: tenant.tenant_id,
                                                data: { is_active: !tenant.is_active },
                                            });
                                        }}
                                        disabled={updateTenant.isPending}
                                        sx={{ borderRadius: 0 }}
                                    >
                                        {tenant.is_active ? 'Deactivate Tenant' : 'Activate Tenant'}
                                    </Button>
                                </>
                            )}
                        </Box>
                    </Box>
                ) : (
                    <Alert severity="error">Tenant not found</Alert>
                )}
            </Box>
        </Drawer>
    );
}

// ─── Audit Log Dialog ────────────────────────────────────────────────────────

function AuditLogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { data, isLoading } = useAdminAuditLog({ limit: 50 });

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Super Admin Audit Log
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {data?.entries && data.entries.length > 0 ? (
                            data.entries.map((entry) => (
                                <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box>
                                            <Typography variant="body2" fontWeight={600}>
                                                {entry.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {entry.admin_email} → {entry.target_tenant_name || '—'}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(entry.created_at).toLocaleString()}
                                        </Typography>
                                    </Box>
                                </Paper>
                            ))
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                No audit log entries yet
                            </Typography>
                        )}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TenantManagementPage() {
    const router = useRouter();
    const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
    const { data: tenants = [], isLoading: tenantsLoading, error, refetch } = useTenants();
    const { data: tenantContext } = useTenantContext();
    const clearContext = useClearTenantContext();
    const switchContext = useSwitchTenantContext();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
    const [auditLogOpen, setAuditLogOpen] = useState(false);

    // ─── Authorization Check ───────────────────────────────────────────────────

    if (permissionsLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!permissions?.isSuperAdmin) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Alert severity="error" variant="filled" sx={{ maxWidth: 600, mx: 'auto', mt: 8 }}>
                    <Typography variant="h6">Access Denied</Typography>
                    <Typography>You do not have the required permissions to view this page. This area is restricted to Super Admins only.</Typography>
                    <Button
                        variant="contained"
                        color="inherit"
                        sx={{ mt: 2, color: 'error.main' }}
                        onClick={() => router.push('/dashboard')}
                    >
                        Back to Dashboard
                    </Button>
                </Alert>
            </Box>
        );
    }

    // ─── DataGrid Columns ───────────────────────────────────────────────────────

    const columns: GridColDef[] = [
        {
            field: 'tenant_name',
            headerName: 'Organization',
            flex: 1,
            minWidth: 200,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Box>
                        <Typography variant="body2" fontWeight={500}>
                            {params.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {params.row.tenant_slug}
                        </Typography>
                    </Box>
                </Box>
            ),
        },
        {
            field: 'is_active',
            headerName: 'Status',
            width: 110,
            renderCell: (params) => (
                <Chip
                    label={params.value ? 'Active' : 'Inactive'}
                    color={params.value ? 'success' : 'default'}
                    size="small"
                />
            ),
        },
        {
            field: 'subscription_tier',
            headerName: 'Tier',
            width: 130,
            renderCell: (params) => (
                <Chip
                    label={params.value}
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: 'capitalize' }}
                />
            ),
        },
        {
            field: 'user_count',
            headerName: 'Users',
            width: 100,
            type: 'number',
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PeopleIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                        {params.value ?? 0} / {params.row.max_users}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'contact_email',
            headerName: 'Contact',
            width: 200,
            renderCell: (params) => (
                <Box>
                    <Typography variant="body2">{params.row.contact_name || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {params.value || ''}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'created_at',
            headerName: 'Created',
            width: 120,
            renderCell: (params) => (
                <Typography variant="body2">
                    {new Date(params.value).toLocaleDateString()}
                </Typography>
            ),
        },
        {
            field: 'actions',
            type: 'actions',
            headerName: '',
            width: 120,
            getActions: (params) => [
                <GridActionsCellItem
                    key="view"
                    icon={
                        <Tooltip title="View Details">
                            <SettingsIcon />
                        </Tooltip>
                    }
                    label="Details"
                    onClick={() => {
                        setSelectedTenantId(params.row.tenant_id);
                        setDetailDrawerOpen(true);
                    }}
                />,
                <GridActionsCellItem
                    key="switch"
                    icon={
                        <Tooltip title="Switch Into Tenant">
                            <SwapIcon />
                        </Tooltip>
                    }
                    label="Switch"
                    onClick={() => switchContext.mutate(params.row.tenant_id)}
                />,
            ],
        },
    ];

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', width: '100%' }}>
            {/* Context Override Banner */}
            {tenantContext?.override_active && tenantContext.tenant && (
                <Alert
                    severity="warning"
                    icon={<ShieldIcon />}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            startIcon={<ExitIcon />}
                            onClick={() => clearContext.mutate()}
                            disabled={clearContext.isPending}
                        >
                            Exit
                        </Button>
                    }
                    sx={{ mb: 2 }}
                >
                    You are viewing as tenant: <strong>{tenantContext.tenant.tenant_name}</strong> ({tenantContext.tenant.tenant_slug})
                </Alert>
            )}

            {/* Page Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                        Tenant Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Super Admin — Manage all organizations on the platform
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateDialogOpen(true)}
                        sx={{ borderRadius: 0, fontWeight: 600 }}
                    >
                        Add Tenant
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<HistoryIcon />}
                        onClick={() => setAuditLogOpen(true)}
                        sx={{ borderRadius: 0 }}
                    >
                        Audit Log
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => refetch()}
                        sx={{ borderRadius: 0 }}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.primary.main}` }}>
                        <CardContent sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">Total Tenants</Typography>
                            <Typography variant="h4" fontWeight={700} color="primary.main">
                                {tenants.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.success.main}` }}>
                        <CardContent sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">Active</Typography>
                            <Typography variant="h4" fontWeight={700} color="success.main">
                                {tenants.filter((t) => t.is_active).length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}` }}>
                        <CardContent sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">Total Users</Typography>
                            <Typography variant="h4" fontWeight={700} color="info.main">
                                {tenants.reduce((sum, t) => sum + (t.user_count || 0), 0)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.warning.main}` }}>
                        <CardContent sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">Inactive</Typography>
                            <Typography variant="h4" fontWeight={700} color="warning.main">
                                {tenants.filter((t) => !t.is_active).length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Error */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {(error as Error).message}
                </Alert>
            )}

            {/* Tenant Data Grid */}
            <BaseDataTable
                title="Tenants"
                data={tenants.map(t => ({ ...t, id: t.tenant_id }))}
                columns={columns}
                loading={tenantsLoading}
                rowHeight={70}
                getRowId={(row: any) => row.tenant_id}
                showCreateButton
                createButtonText="Add Tenant"
                showActionsColumn={false}
                pageSize={25}
                pageSizeOptions={[10, 25, 50]}
                autoHeight
                onRowClick={(row: any) => {
                    setSelectedTenantId(row.tenant_id);
                    setDetailDrawerOpen(true);
                }}
            />

            {/* Dialogs */}
            <CreateTenantDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
            <TenantDetailDrawer tenantId={selectedTenantId} open={detailDrawerOpen} onClose={() => setDetailDrawerOpen(false)} />

            <AuditLogDialog open={auditLogOpen} onClose={() => setAuditLogOpen(false)} />
        </Box>
    );
}