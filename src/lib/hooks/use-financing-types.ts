import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FinancingTypes } from '@/types/database.types';
import { FinancingTypesFormData, FinancingTypesUpdateData } from '@/lib/validations/financing-types';

const financingTypesKeys = {
  all: ['financing-types'] as const,
  list: () => [...financingTypesKeys.all, 'list'] as const,
  active: () => [...financingTypesKeys.all, 'active'] as const,
  detail: (id: string) => [...financingTypesKeys.all, 'detail', id] as const,
};

export function useFinancingTypes() {
  return useQuery<FinancingTypes[], Error>({
    queryKey: financingTypesKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/financing-types');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch financing types');
      return json.data as FinancingTypes[];
    },
  });
}

export function useActiveFinancingTypes() {
  return useQuery<FinancingTypes[], Error>({
    queryKey: financingTypesKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/financing-types');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch financing types');
      return (json.data as FinancingTypes[]).filter(type => type.active_flag);
    },
  });
}

export function useCreateFinancingTypes() {
  const queryClient = useQueryClient();
  
  return useMutation<FinancingTypes, Error, FinancingTypesFormData>({
    mutationFn: async (data) => {
      const res = await fetch('/api/financing-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create financing type');
      return json.data as FinancingTypes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financingTypesKeys.all });
      toast.success('Financing type created successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create financing type');
    },
  });
}

export function useUpdateFinancingTypes() {
  const queryClient = useQueryClient();
  
  return useMutation<FinancingTypes, Error, { id: string; data: FinancingTypesUpdateData }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/financing-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update financing type');
      return json.data as FinancingTypes;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: financingTypesKeys.all });
      queryClient.invalidateQueries({ queryKey: financingTypesKeys.detail(variables.id) });
      toast.success('Financing type updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update financing type');
    },
  });
}

export function useDeleteFinancingTypes() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/financing-types/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete financing type');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financingTypesKeys.all });
      toast.success('Financing type deleted successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete financing type');
    },
  });
}

