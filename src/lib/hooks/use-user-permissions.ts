import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

// Hook to get current user's menu permissions
export function useUserPermissions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Clear user permissions cache when user changes
  useEffect(() => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    }
  }, [user?.id, queryClient]);
  
  return useQuery({
    queryKey: ['user-permissions', user?.id], // Include user ID in query key
    queryFn: async (): Promise<{ isAdmin: boolean; permissions: string[]; isActive: boolean }> => {
      const response = await fetch('/api/user/permissions');
      
      if (!response.ok) {
        if (response.status === 401) {
          return { isAdmin: false, permissions: [], isActive: false };
        }
        throw new Error('Failed to fetch user permissions');
      }
      
      const data = await response.json();
      return {
        isAdmin: data.isAdmin,
        permissions: data.permissions || [],
        isActive: data.isActive
      };
    },
    staleTime: 0, // Always refetch when user changes
    retry: false, // Don't retry on 401 (unauthorized)
    enabled: !!user, // Only run when user is available
  });
}
