import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LeadNoteFormData } from '@/lib/validations/lead-notes';
import { BaseEntity } from '@/types/common';

export interface LeadNote extends BaseEntity {
  note_id: number;
  lead_id: number;
  note_type: 'Challenge' | 'Follow-Up' | 'Other' | 'PME' | 'Win';
  note: string;
  created_by: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
  is_alert_source?: boolean;
  is_alert_response?: boolean;
  alert_id?: number | null;
  alert_roles?: string[] | null;
}

export interface LeadNotesResponse {
  data: LeadNote[];
}

// Query keys
export const leadNoteKeys = {
  all: ['lead-notes'] as const,
  lists: () => [...leadNoteKeys.all, 'list'] as const,
  list: (leadId: number) => [...leadNoteKeys.lists(), leadId] as const,
};

// Hook to fetch lead notes
export function useLeadNotes(leadId: number) {
  return useQuery({
    queryKey: leadNoteKeys.list(leadId),
    queryFn: async (): Promise<LeadNotesResponse> => {
      const response = await fetch(`/api/lead-notes?lead_id=${leadId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch lead notes');
      }

      return response.json();
    },
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to create a new lead note
export function useCreateLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LeadNoteFormData): Promise<LeadNote> => {
      const response = await fetch('/api/lead-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create lead note');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (newNote, variables) => {
      // Invalidate and refetch lead notes for this lead
      queryClient.invalidateQueries({
        queryKey: leadNoteKeys.list(variables.lead_id),
      });
      
      // Invalidate leads list to refresh last_followup_note in the grid
      // This ensures the tooltip shows the latest Follow-Up note
      queryClient.invalidateQueries({
        queryKey: ['leads', 'list'],
      });
      
      toast.success('Note added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add note');
    },
  });
}
