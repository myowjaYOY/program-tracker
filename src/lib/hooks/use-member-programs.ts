import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MemberPrograms } from '@/types/database.types';

export const memberProgramKeys = {
  all: ['member-programs'] as const,
  list: () => [...memberProgramKeys.all, 'list'] as const,
  active: () => [...memberProgramKeys.all, 'active'] as const,
  detail: (id: number) => [...memberProgramKeys.all, 'detail', id] as const,
};

export function useMemberPrograms() {
  return useQuery<MemberPrograms[], Error>({
    queryKey: memberProgramKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/member-programs', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch member programs');
      return json.data as MemberPrograms[];
    },
  });
}

export function useActiveMemberPrograms() {
  return useQuery<MemberPrograms[], Error>({
    queryKey: memberProgramKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/member-programs?active=true', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch active member programs');
      return json.data as MemberPrograms[];
    },
  });
}

export function useMemberProgram(id: number) {
  return useQuery<MemberPrograms, Error>({
    queryKey: memberProgramKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/member-programs/${id}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch member program');
      return json.data as MemberPrograms;
    },
    enabled: !!id,
  });
}

export function useCreateMemberProgram() {
  const queryClient = useQueryClient();
  
  return useMutation<MemberPrograms, Error, Partial<MemberPrograms>>({
    mutationFn: async (data) => {
      const res = await fetch('/api/member-programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create member program');
      return json.data as MemberPrograms;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.all });
    },
  });
}

export function useUpdateMemberProgram() {
  const queryClient = useQueryClient();
  
  return useMutation<MemberPrograms, Error, { id: string; data: Partial<MemberPrograms> }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/member-programs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update member program');
      return json.data as MemberPrograms;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.all });
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.detail(data.member_program_id) });
    },
  });
}

export function useDeleteMemberProgram() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/member-programs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete member program');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.all });
    },
  });
}



