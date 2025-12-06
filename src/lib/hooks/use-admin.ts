import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Types
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  program_role_id: number;
  program_roles?: {
    role_name: string;
    display_color: string;
  };
}

export interface MenuItem {
  id: number;
  path: string;
  label: string;
  section: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  full_name?: string;
  password: string;
  is_admin?: boolean;
  is_active?: boolean;
  program_role_id?: number;
}

export interface UpdateUserData {
  full_name?: string;
  is_admin?: boolean;
  is_active?: boolean;
  password?: string;
  program_role_id?: number;
}

// Query keys
export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  user: (id: string) => [...adminKeys.users(), id] as const,
  userPermissions: (id: string) =>
    [...adminKeys.user(id), 'permissions'] as const,
  menuItems: () => [...adminKeys.all, 'menu-items'] as const,
};

// Hooks for users
export function useUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: async (): Promise<User[]> => {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useActiveUsers() {
  return useQuery({
    queryKey: [...adminKeys.users(), 'active'],
    queryFn: async (): Promise<User[]> => {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      return (data.data || []).filter((user: User) => user.is_active);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUserPermissions(userId: string) {
  return useQuery({
    queryKey: adminKeys.userPermissions(userId),
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(`/api/admin/users/${userId}/permissions`);
      if (!response.ok) {
        throw new Error('Failed to fetch user permissions');
      }
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hooks for menu items
export function useMenuItems() {
  return useQuery({
    queryKey: adminKeys.menuItems(),
    queryFn: async (): Promise<MenuItem[]> => {
      const response = await fetch('/api/admin/menu-items');
      if (!response.ok) {
        throw new Error('Failed to fetch menu items');
      }
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Mutations
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: CreateUserData): Promise<User> => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create user');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      userData,
    }: {
      userId: string;
      userData: UpdateUserData;
    }): Promise<User> => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update user');
    },
  });
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      menuPaths,
    }: {
      userId: string;
      menuPaths: string[];
    }): Promise<void> => {
      const response = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ menuPaths }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update permissions');
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: adminKeys.userPermissions(userId),
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string): Promise<string> => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      return userId;
    },
    onMutate: async (userId: string) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.users() });
      const prev = queryClient.getQueryData<User[]>(adminKeys.users());
      if (prev) {
        queryClient.setQueryData(
          adminKeys.users(),
          prev.filter(user => user.id !== userId)
        );
      }
      return { prev };
    },
    onError: (err: Error, userId, context) => {
      toast.error(err.message || 'Failed to delete user');
      if (context?.prev) {
        queryClient.setQueryData(adminKeys.users(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useSyncMenuItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{
      synced: number;
      new: number;
      total: number;
    }> => {
      const response = await fetch('/api/admin/menu-items/sync', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync menu items');
      }

      const data = await response.json();
      return {
        synced: data.synced,
        new: data.new,
        total: data.total,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.menuItems() });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}
