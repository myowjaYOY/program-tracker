import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import { useQuery } from '@tanstack/react-query';
import type { Leads } from '@/types/database.types';
import type { LeadFormData } from '@/lib/validations/lead';
import { LeadWithMetadata } from '@/lib/data/leads';

const hooks = createEntityHooks<LeadWithMetadata, LeadFormData, Partial<LeadFormData>, string | number>({
    entityName: 'Lead',
    endpoint: '/api/leads',
    queryKey: 'leads',
    idField: 'lead_id',
    listQueryOptions: {
        staleTime: 30 * 1000, // 30 seconds - shorter cache for note counts
        gcTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: true, // Refetch when window gains focus
    },
});

export const leadKeys = hooks.keys;
export const useLeads = hooks.useList;
export const useActiveLeads = hooks.useActive;
export const useLeadDetail = hooks.useDetail;
export const useCreateLead = hooks.useCreate;
export const useUpdateLead = hooks.useUpdate;
export const useDeleteLead = hooks.useDelete;

// Custom hook for program creation - filters for specific statuses
export function useLeadsForProgramCreation() {
    return useQuery<Leads[], Error>({
        queryKey: [...leadKeys.all, 'program-creation'],
        queryFn: async () => {
            const res = await fetch('/api/leads', {
                credentials: 'include',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch leads');

            // Filter for leads with status: PME Scheduled, Won, Confirmed, Follow Up
            // These correspond to status_id: 2, 4, 5, 11 respectively
            return (json.data as Leads[]).filter(l =>
                l.active_flag &&
                l.status_id &&
                [2, 4, 5, 11].includes(l.status_id)
            );
        },
    });
}
