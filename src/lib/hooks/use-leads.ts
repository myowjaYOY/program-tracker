import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Leads } from '@/types/database.types';
import { LeadFormData, LeadUpdateData } from '@/lib/validations/lead';

const leadKeys = {
  all: ['leads'] as const,
  list: () => [...leadKeys.all, 'list'] as const,
  active: () => [...leadKeys.all, 'active'] as const,
  detail: (id: string) => [...leadKeys.all, 'detail', id] as const,
};

export function useLeads() {
  return useQuery<Leads[], Error>({
    queryKey: leadKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/leads', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch leads');
      return json.data as Leads[];
    },
    staleTime: 30 * 1000, // 30 seconds - shorter cache for note counts
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}

export function useActiveLeads() {
  return useQuery<Leads[], Error>({
    queryKey: leadKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/leads', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch leads');
      return (json.data as Leads[]).filter(l => l.active_flag);
    },
  });
}

export function useLeadsForProgramCreation() {
  return useQuery<Leads[], Error>({
    queryKey: [...leadKeys.all, 'program-creation'],
    queryFn: async () => {
      const res = await fetch('/api/leads', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch leads');
      
      // Filter for leads with status: Confirmed, PME Scheduled, Follow Up
      // These correspond to status_id: 5, 2, 11 respectively
      return (json.data as Leads[]).filter(l => 
        l.active_flag && 
        l.status_id && 
        [5, 2, 11].includes(l.status_id)
      );
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: LeadFormData) => {
      const res = await fetch('/api/leads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create lead');
      return json.data as Leads;
    },
    onSuccess: () => {
      toast.success('Lead created');
      queryClient.invalidateQueries({ queryKey: leadKeys.list() });
      queryClient.invalidateQueries({ queryKey: leadKeys.active() });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create lead');
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadUpdateData) => {
      const res = await fetch(`/api/leads/${input.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update lead');
      return json.data as Leads;
    },
    onSuccess: () => {
      toast.success('Lead updated');
      queryClient.invalidateQueries({ queryKey: leadKeys.list() });
      queryClient.invalidateQueries({ queryKey: leadKeys.active() });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update lead');
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete lead');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      const prev = queryClient.getQueryData<Leads[]>(leadKeys.list());
      if (prev) {
        queryClient.setQueryData(
          leadKeys.list(),
          prev.filter(l => l.lead_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete lead');
      if (context?.prev) {
        queryClient.setQueryData(leadKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Lead deleted');
      queryClient.invalidateQueries({ queryKey: leadKeys.list() });
      queryClient.invalidateQueries({ queryKey: leadKeys.active() });
    },
  });
}
