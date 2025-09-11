'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TextField,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Checkbox,
  Alert,
  Divider,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';

import {
  UserFormData,
  userSchema,
  userUpdateSchema,
  userPasswordUpdateSchema,
} from '@/lib/validations/user';
import { z } from 'zod';
import BaseForm from './base-form';
import {
  useCreateUser,
  useUpdateUser,
  useUserPermissions,
  useMenuItems,
  useUpdateUserPermissions,
} from '@/lib/hooks/use-admin';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface UserFormProps {
  initialValues?: Partial<UserFormData> & { id?: string };
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function UserForm({
  initialValues,
  onSuccess,
  mode = 'create',
}: UserFormProps) {
  const isEdit = mode === 'edit';
  const [selectedMenuPaths, setSelectedMenuPaths] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Create combined schema for edit mode that includes optional password
  const editSchema = userUpdateSchema.extend({
    password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(isEdit ? editSchema : userSchema),
    defaultValues: {
      email: '',
      full_name: '',
      password: '',
      is_admin: false,
      is_active: false,
      ...initialValues,
    },
  });

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const updatePermissions = useUpdateUserPermissions();

  // For edit mode, fetch user permissions and menu items
  const { data: userPermissions, isLoading: userPermissionsLoading } = useUserPermissions(initialValues?.id || '');
  const { data: menuItems, isLoading: menuItemsLoading } = useMenuItems();

  // Update selected menu paths when user permissions are loaded
  useEffect(() => {
    if (userPermissions && isEdit) {
      setSelectedMenuPaths(userPermissions);
    }
  }, [userPermissions, isEdit]);

  const handleMenuPathToggle = (path: string) => {
    setSelectedMenuPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSectionToggle = (section: string) => {
    const sectionPaths = getSectionItems(section).map(item => item.path);

    const allSelected = sectionPaths.every(path =>
      selectedMenuPaths.includes(path)
    );

    if (allSelected) {
      setSelectedMenuPaths(prev =>
        prev.filter(path => !sectionPaths.includes(path))
      );
    } else {
      setSelectedMenuPaths(prev => [...new Set([...prev, ...sectionPaths])]);
    }
  };

  const getSectionItems = (section: string) => {
    if (section === 'admin') {
      // Return only the main admin items (not lookup items)
      return menuItems?.filter(item => 
        item.section === 'admin' && 
        !['/dashboard/bodies', '/dashboard/buckets', '/dashboard/financing-types', '/dashboard/status', '/dashboard/payment-methods', '/dashboard/payment-status', '/dashboard/pillars', '/dashboard/program-status', '/dashboard/therapy-type', '/dashboard/vendors'].includes(item.path)
      ) || [];
    } else if (section === 'lookup') {
      // Return the lookup items
      return menuItems?.filter(item => 
        ['/dashboard/bodies', '/dashboard/buckets', '/dashboard/financing-types', '/dashboard/status', '/dashboard/payment-methods', '/dashboard/payment-status', '/dashboard/pillars', '/dashboard/program-status', '/dashboard/therapy-type', '/dashboard/vendors'].includes(item.path)
      ) || [];
    } else {
      return menuItems?.filter(item => item.section === section) || [];
    }
  };

  const isSectionFullySelected = (section: string) => {
    const sectionPaths = getSectionItems(section).map(item => item.path);
    return (
      sectionPaths.length > 0 &&
      sectionPaths.every(path => selectedMenuPaths.includes(path))
    );
  };

  const isSectionPartiallySelected = (section: string) => {
    const sectionPaths = getSectionItems(section).map(item => item.path);
    return (
      sectionPaths.some(path => selectedMenuPaths.includes(path)) &&
      !isSectionFullySelected(section)
    );
  };

  // Show loading state while data is being fetched in edit mode
  if (isEdit && (userPermissionsLoading || menuItemsLoading)) {
    return (
      <BaseForm<UserFormData>
        onSubmit={() => {}}
        submitHandler={() => {}}
        isSubmitting={true}
        submitText="Loading..."
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Loading user data and menu permissions...
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          </Box>
        </Box>
      </BaseForm>
    );
  }

  const onSubmit = async (values: UserFormData) => {
    if (isEdit && initialValues?.id) {
      // Update user basic information
      await updateUser.mutateAsync({
        userId: initialValues.id,
        userData: {
          email: values.email,
          full_name: values.full_name || '',
          is_admin: values.is_admin,
          is_active: values.is_active,
          password: values.password || '',
        },
      });

      // Update permissions if not admin
      if (!values.is_admin) {
        await updatePermissions.mutateAsync({
          userId: initialValues.id,
          menuPaths: selectedMenuPaths,
        });
      }
    } else {
      // Create new user
      await createUser.mutateAsync({
        ...values,
        full_name: values.full_name || '',
      });
    }

    if (onSuccess) onSuccess();
  };

  const isAdmin = watch('is_admin');

  return (
    <BaseForm<UserFormData>
      onSubmit={onSubmit}
      submitHandler={handleSubmit(onSubmit)}
      isSubmitting={
        isSubmitting ||
        createUser.isPending ||
        updateUser.isPending ||
        updatePermissions.isPending
      }
      submitText={isEdit ? 'Update' : 'Create'}
    >
      <TextField
        label="Email"
        fullWidth
        required
        {...register('email')}
        error={!!errors.email}
        helperText={errors.email?.message}
        disabled={isEdit}
      />


      <TextField
        label="Full Name"
        fullWidth
        {...register('full_name')}
        error={!!errors.full_name}
        helperText={errors.full_name?.message}
      />

      {!isEdit && (
        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          fullWidth
          required
          {...register('password')}
          error={!!errors.password}
          helperText={errors.password?.message}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      )}

      {isEdit && (
        <TextField
          label="New Password (leave blank to keep current)"
          type={showPassword ? 'text' : 'password'}
          fullWidth
          {...register('password')}
          error={!!errors.password}
          helperText={errors.password?.message || 'Enter a new password to reset, or leave blank to keep current password'}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      )}

      <FormControlLabel
        control={
          <Switch
            color="primary"
            checked={!!watch('is_admin')}
            onChange={(_, checked) => setValue('is_admin', checked)}
          />
        }
        label="Admin User (has access to all menu items)"
      />

      <FormControlLabel
        control={
          <Switch
            color="primary"
            checked={!!watch('is_active')}
            onChange={(_, checked) => setValue('is_active', checked)}
          />
        }
        label="Active User"
      />

      {/* Menu Permissions Section - Only show in edit mode and for non-admin users */}
      {isEdit && !isAdmin && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="h6" gutterBottom>
              Menu Access
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select which menu items this user can access.
            </Typography>

            {userPermissionsLoading || menuItemsLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Loading menu permissions...
                </Typography>
              </Box>
            ) : (
              <>
                {/* Main sections */}
                {['main', 'marketing', 'sales'].map(section => {
                  const sectionItems = getSectionItems(section);
                  if (sectionItems.length === 0) return null;

                  return (
                    <Box key={section} sx={{ mb: 3 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isSectionFullySelected(section)}
                            indeterminate={isSectionPartiallySelected(section)}
                            onChange={() => handleSectionToggle(section)}
                          />
                        }
                        label={
                          <Typography
                            variant="subtitle1"
                            sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                          >
                            {section} ({sectionItems.length} items)
                          </Typography>
                        }
                      />

                      <Box
                        sx={{
                          ml: 4,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {sectionItems.map(item => (
                          <FormControlLabel
                            key={item.path}
                            control={
                              <Checkbox
                                checked={selectedMenuPaths.includes(item.path)}
                                onChange={() => handleMenuPathToggle(item.path)}
                              />
                            }
                            label={item.label}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}

                {/* Admin section with nested Lookup */}
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isSectionFullySelected('admin')}
                        indeterminate={isSectionPartiallySelected('admin')}
                        onChange={() => handleSectionToggle('admin')}
                      />
                    }
                    label={
                      <Typography
                        variant="subtitle1"
                        sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                      >
                        Admin ({getSectionItems('admin').length} items)
                      </Typography>
                    }
                  />

                  <Box
                    sx={{
                      ml: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    {/* Main Admin items */}
                    {getSectionItems('admin').map(item => (
                      <FormControlLabel
                        key={item.path}
                        control={
                          <Checkbox
                            checked={selectedMenuPaths.includes(item.path)}
                            onChange={() => handleMenuPathToggle(item.path)}
                          />
                        }
                        label={item.label}
                      />
                    ))}

                    {/* Lookup submenu */}
                    <Box sx={{ mt: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isSectionFullySelected('lookup')}
                            indeterminate={isSectionPartiallySelected('lookup')}
                            onChange={() => handleSectionToggle('lookup')}
                          />
                        }
                        label={
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, color: 'text.secondary' }}
                          >
                            Lookup ({getSectionItems('lookup').length} items)
                          </Typography>
                        }
                      />

                      <Box
                        sx={{
                          ml: 4,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {getSectionItems('lookup').map(item => (
                          <FormControlLabel
                            key={item.path}
                            control={
                              <Checkbox
                                checked={selectedMenuPaths.includes(item.path)}
                                onChange={() => handleMenuPathToggle(item.path)}
                              />
                            }
                            label={item.label}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </>
      )}

      {isEdit && isAdmin && (
        <Alert severity="info">
          Admin users have access to all menu items automatically.
        </Alert>
      )}
    </BaseForm>
  );
}
