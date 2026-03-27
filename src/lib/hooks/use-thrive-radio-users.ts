import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ThriveRadioProfile } from '@/types/database.types';
import { AddThriveRadioUserData } from '@/lib/validations/thrive-radio-user';

export interface ThriveRadioCandidate {
  id: string | number;
  name: string;
  email: string;
  type: 'lead' | 'employee';
}

interface AddUserResponse {
  data: ThriveRadioProfile;
  generatedPassword?: string;
  existingCredentials?: boolean;
  message: string;
}

export const thriveRadioUserKeys = {
  all: ['thrive-radio-users'] as const,
  list: () => [...thriveRadioUserKeys.all, 'list'] as const,
  candidates: () => [...thriveRadioUserKeys.all, 'candidates'] as const,
};

export function useThriveRadioUsers() {
  return useQuery<ThriveRadioProfile[], Error>({
    queryKey: thriveRadioUserKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/admin/thrive-radio-users', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch Thrive Radio users');
      return json.data as ThriveRadioProfile[];
    },
  });
}

export function useThriveRadioUserCandidates() {
  return useQuery<ThriveRadioCandidate[], Error>({
    queryKey: thriveRadioUserKeys.candidates(),
    queryFn: async () => {
      const res = await fetch('/api/admin/thrive-radio-users/candidates', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch candidates');
      return json.data as ThriveRadioCandidate[];
    },
  });
}

export function useAddThriveRadioUser() {
  const queryClient = useQueryClient();
  return useMutation<AddUserResponse, Error, AddThriveRadioUserData>({
    mutationFn: async (data: AddThriveRadioUserData) => {
      const res = await fetch('/api/admin/thrive-radio-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to add Thrive Radio user');
      return json as AddUserResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: thriveRadioUserKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add Thrive Radio user');
    },
  });
}

export function useDeleteThriveRadioUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/thrive-radio-users/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to delete Thrive Radio user');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: thriveRadioUserKeys.all });
      const prev = queryClient.getQueryData<ThriveRadioProfile[]>(
        thriveRadioUserKeys.list()
      );
      if (prev) {
        queryClient.setQueryData(
          thriveRadioUserKeys.list(),
          prev.filter((p) => p.id !== id)
        );
      }
      return { prev };
    },
    onError: (err: Error, _id, context) => {
      toast.error(err.message || 'Failed to delete Thrive Radio user');
      if (context?.prev) {
        queryClient.setQueryData(thriveRadioUserKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Thrive Radio user deleted');
      queryClient.invalidateQueries({ queryKey: thriveRadioUserKeys.all });
    },
  });
}
