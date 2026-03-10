'use client';

import React, { useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Checkbox,
    Typography,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    CircularProgress,
    Alert,
    Tooltip,
} from '@mui/material';
import {
    Add as AddIcon,
    Close as CloseIcon,
    PersonAdd as PersonAddIcon,
    Delete as DeleteIcon,
    Mail as MailIcon,
    AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import {
    useTenantUsers,
    useProvisionTenantUser,
    useDeleteTenantUser,
    type ProvisionUserData,
} from '@/lib/hooks/use-tenant-users';

interface ProvisionUserDialogProps {
    open: boolean;
    onClose: () => void;
    tenantId: string;
    tenantName: string;
}

function ProvisionUserDialog({ open, onClose, tenantId, tenantName }: ProvisionUserDialogProps) {
    const provisionUser = useProvisionTenantUser(tenantId);
    const [form, setForm] = useState<ProvisionUserData>({
        email: '',
        full_name: '',
        is_admin: false,
        send_invite: true,
    });

    const handleSubmit = async () => {
        if (!form.email) return;

        try {
            await provisionUser.mutateAsync(form);
            onClose();
            setForm({ email: '', full_name: '', is_admin: false, send_invite: true });
        } catch {
            // Error handled by mutation
        }
    };

    const handleClose = () => {
        if (!provisionUser.isPending) {
            onClose();
            setForm({ email: '', full_name: '', is_admin: false, send_invite: true });
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonAddIcon color="primary" />
                    Add User to {tenantName}
                </Box>
                <IconButton onClick={handleClose} size="small" disabled={provisionUser.isPending}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label="Email Address"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                        fullWidth
                        required
                        autoFocus
                        disabled={provisionUser.isPending}
                    />
                    <TextField
                        label="Full Name (optional)"
                        value={form.full_name}
                        onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                        fullWidth
                        disabled={provisionUser.isPending}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={form.is_admin}
                                onChange={(e) => setForm((prev) => ({ ...prev, is_admin: e.target.checked }))}
                                disabled={provisionUser.isPending}
                            />
                        }
                        label="Make this user a Tenant Admin"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={form.send_invite}
                                onChange={(e) => setForm((prev) => ({ ...prev, send_invite: e.target.checked }))}
                                disabled={provisionUser.isPending}
                            />
                        }
                        label="Send invite email with password setup link"
                    />

                    {!form.send_invite && (
                        <Alert severity="info" sx={{ mt: 1 }}>
                            User will be created but won't receive an email. You'll need to manually share login instructions.
                        </Alert>
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleClose} disabled={provisionUser.isPending}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={!form.email || provisionUser.isPending}
                    startIcon={provisionUser.isPending ? <CircularProgress size={16} /> : <AddIcon />}
                >
                    {provisionUser.isPending ? 'Creating...' : 'Create User'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

interface TenantUsersTableProps {
    tenantId: string;
    tenantName: string;
}

export default function TenantUsersTable({ tenantId, tenantName }: TenantUsersTableProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

    const { data, isLoading, error } = useTenantUsers(tenantId);
    const deleteUser = useDeleteTenantUser(tenantId);

    const handleDeleteConfirm = async () => {
        if (!deleteUserId) return;
        try {
            await deleteUser.mutateAsync(deleteUserId);
            setDeleteUserId(null);
        } catch {
            // Error handled by mutation
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ my: 2 }}>
                Failed to load users: {error.message}
            </Alert>
        );
    }

    const users = data?.users || [];
    const userToDelete = users.find((u) => u.id === deleteUserId);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Users ({data?.count || 0})
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setDialogOpen(true)}
                    size="small"
                >
                    Add User
                </Button>
            </Box>

            {users.length === 0 ? (
                <Alert severity="info">
                    No users in this tenant yet. Click "Add User" to provision the first user.
                </Alert>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Email</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Role</TableCell>
                                <TableCell>Created</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id} hover>
                                    <TableCell>
                                        <Typography variant="body2">{user.email}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {user.full_name || '—'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {user.is_super_admin ? (
                                            <Chip
                                                label="Super Admin"
                                                size="small"
                                                color="error"
                                                icon={<AdminIcon />}
                                            />
                                        ) : user.is_admin ? (
                                            <Chip
                                                label="Admin"
                                                size="small"
                                                color="primary"
                                                icon={<AdminIcon />}
                                            />
                                        ) : (
                                            <Chip label="User" size="small" variant="outlined" />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Delete user">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => setDeleteUserId(user.id)}
                                                    disabled={user.is_super_admin}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Provision User Dialog */}
            <ProvisionUserDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                tenantId={tenantId}
                tenantName={tenantName}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteUserId} onClose={() => setDeleteUserId(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Delete User?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete <strong>{userToDelete?.email}</strong>?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        This will remove the user from both the tenant and the authentication system.
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteUserId(null)} disabled={deleteUser.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        variant="contained"
                        disabled={deleteUser.isPending}
                    >
                        {deleteUser.isPending ? 'Deleting...' : 'Delete User'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}