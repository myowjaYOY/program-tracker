import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Buckets } from '@/types/database.types';
import { BucketFormData, BucketUpdateData } from '@/lib/validations/bucket';

const bucketKeys = {
  all: ['buckets'] as const,
  list: () => [...bucketKeys.all, 'list'] as const,
  active: () => [...bucketKeys.all, 'active'] as const,
  detail: (id: string) => [...bucketKeys.all, 'detail', id] as const,
};

export function useBuckets() {
  return useQuery({
    queryKey: bucketKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/buckets');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch buckets');
      return json.data;
    },
  });
}

export function useActiveBuckets() {
  return useQuery({
    queryKey: bucketKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/buckets?active=true');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch buckets');
      return json.data;
    },
  });
}

export function useCreateBucket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BucketFormData) => {
      const res = await fetch('/api/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create bucket');
      return json.data;
    },
    onSuccess: () => {
      toast.success('Bucket created successfully');
      queryClient.invalidateQueries({ queryKey: bucketKeys.all });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create bucket');
    },
  });
}

export function useUpdateBucket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: BucketUpdateData;
    }) => {
      const res = await fetch(`/api/buckets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update bucket');
      return json.data;
    },
    onSuccess: () => {
      toast.success('Bucket updated successfully');
      queryClient.invalidateQueries({ queryKey: bucketKeys.all });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update bucket');
    },
  });
}

export function useDeleteBucket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/buckets/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete bucket');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: bucketKeys.all });
      const previous = queryClient.getQueryData(bucketKeys.list());
      queryClient.setQueryData(bucketKeys.list(), (old: any) =>
        (old?.data || []).filter((b: any) => b.bucket_id !== id)
      );
      return { previous };
    },
    onError: (err: any, _id, context: any) => {
      toast.error(err?.message || 'Failed to delete bucket');
      if (context?.previous) {
        queryClient.setQueryData(bucketKeys.list(), context.previous);
      }
    },
    onSuccess: () => {
      toast.success('Bucket deleted successfully');
      queryClient.invalidateQueries({ queryKey: bucketKeys.all });
    },
  });
}
