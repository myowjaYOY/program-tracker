import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TherapiesBodiesPillars } from '@/types/database.types';
import {
  TherapyRelationshipFormData,
  TherapyRelationshipUpdateData,
} from '@/lib/validations/therapy-relationships';

const therapyRelationshipKeys = {
  all: ['therapy-relationships'] as const,
  list: (therapyId: string) =>
    [...therapyRelationshipKeys.all, 'list', therapyId] as const,
  detail: (therapyId: string, bodyId: string, pillarId: string) =>
    [
      ...therapyRelationshipKeys.all,
      'detail',
      therapyId,
      bodyId,
      pillarId,
    ] as const,
};

export function useTherapyRelationships(therapyId: string) {
  return useQuery<TherapiesBodiesPillars[], Error>({
    queryKey: therapyRelationshipKeys.list(therapyId),
    queryFn: async () => {
      const res = await fetch(`/api/therapies/${therapyId}/bodies-pillars`);
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch therapy relationships');
      return json.data as TherapiesBodiesPillars[];
    },
    enabled: !!therapyId,
  });
}

export function useCreateTherapyRelationship(therapyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<TherapyRelationshipFormData, 'therapy_id'>
    ) => {
      const res = await fetch(`/api/therapies/${therapyId}/bodies-pillars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create therapy relationship');
      return json.data as TherapiesBodiesPillars;
    },
    onSuccess: () => {
      toast.success('Relationship created successfully');
      queryClient.invalidateQueries({
        queryKey: therapyRelationshipKeys.list(therapyId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create relationship');
    },
  });
}

export function useUpdateTherapyRelationship(therapyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bodyId: string;
      pillarId: string;
      data: TherapyRelationshipUpdateData;
    }) => {
      const res = await fetch(
        `/api/therapies/${therapyId}/bodies-pillars/${input.bodyId}/${input.pillarId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input.data),
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update therapy relationship');
      return json.data as TherapiesBodiesPillars;
    },
    onSuccess: () => {
      toast.success('Relationship updated successfully');
      queryClient.invalidateQueries({
        queryKey: therapyRelationshipKeys.list(therapyId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update relationship');
    },
  });
}

export function useDeleteTherapyRelationship(therapyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { bodyId: string; pillarId: string }) => {
      const res = await fetch(
        `/api/therapies/${therapyId}/bodies-pillars/${input.bodyId}/${input.pillarId}`,
        {
          method: 'DELETE',
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to delete therapy relationship');
      return json.data;
    },
    onSuccess: () => {
      toast.success('Relationship deleted successfully');
      queryClient.invalidateQueries({
        queryKey: therapyRelationshipKeys.list(therapyId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete relationship');
    },
  });
}
