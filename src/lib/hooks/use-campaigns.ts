import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Campaigns } from '@/types/database.types';
import {
  CampaignFormData,
  CampaignUpdateData,
} from '@/lib/validations/campaign';

const campaignKeys = {
  all: ['campaigns'] as const,
  list: () => [...campaignKeys.all, 'list'] as const,
  active: () => [...campaignKeys.all, 'active'] as const,
  detail: (id: string) => [...campaignKeys.all, 'detail', id] as const,
};

export function useCampaigns() {
  return useQuery<Campaigns[], Error>({
    queryKey: campaignKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/campaigns', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch campaigns');
      return json.data as Campaigns[];
    },
  });
}

export function useActiveCampaigns() {
  return useQuery<Campaigns[], Error>({
    queryKey: campaignKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/campaigns', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch campaigns');
      return (json.data as Campaigns[]).filter(c => c.active_flag);
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create campaign');
      return json.data as Campaigns;
    },
    onSuccess: () => {
      toast.success('Campaign created');
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create campaign');
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CampaignUpdateData) => {
      const res = await fetch(`/api/campaigns/${input.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update campaign');
      return json.data as Campaigns;
    },
    onSuccess: () => {
      toast.success('Campaign updated');
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update campaign');
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete campaign');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: campaignKeys.all });
      const prev = queryClient.getQueryData<Campaigns[]>(campaignKeys.list());
      if (prev) {
        queryClient.setQueryData(
          campaignKeys.list(),
          prev.filter(c => c.campaign_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete campaign');
      if (context?.prev) {
        queryClient.setQueryData(campaignKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}
