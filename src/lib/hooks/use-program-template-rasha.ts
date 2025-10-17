import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramTemplateRasha } from '@/types/database.types';
import { toast } from 'sonner';

export const programTemplateRashaKeys = {
  all: ['program-template-rasha'] as const,
  list: () => [...programTemplateRashaKeys.all, 'list'] as const,
  byTemplate: (templateId: number) =>
    [...programTemplateRashaKeys.all, 'by-template', templateId] as const,
  detail: (id: number) =>
    [...programTemplateRashaKeys.all, 'detail', id] as const,
};

export function useProgramTemplateRashaItems(templateId: number) {
  return useQuery<ProgramTemplateRasha[], Error>({
    queryKey: programTemplateRashaKeys.byTemplate(templateId),
    queryFn: async () => {
      const res = await fetch(`/api/program-templates/${templateId}/rasha`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program template RASHA items');
      return json.data as ProgramTemplateRasha[];
    },
    enabled: !!templateId,
  });
}

export function useCreateProgramTemplateRashaItem() {
  const queryClient = useQueryClient();

  return useMutation<
    ProgramTemplateRasha,
    Error,
    Partial<ProgramTemplateRasha> & { program_template_id: number }
  >({
    mutationFn: async data => {
      const res = await fetch(
        `/api/program-templates/${data.program_template_id}/rasha`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create program template RASHA item');
      return json.data as ProgramTemplateRasha;
    },
    onSuccess: data => {
      if (data.program_template_id) {
        queryClient.invalidateQueries({
          queryKey: programTemplateRashaKeys.byTemplate(data.program_template_id),
        });
      }
      toast.success('RASHA item added to template successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to add RASHA item to template');
    },
  });
}

export function useUpdateProgramTemplateRashaItem() {
  const queryClient = useQueryClient();

  return useMutation<
    ProgramTemplateRasha,
    Error,
    { templateId: number; rashaId: number; data: Partial<ProgramTemplateRasha> }
  >({
    mutationFn: async ({ templateId, rashaId, data }) => {
      const res = await fetch(
        `/api/program-templates/${templateId}/rasha/${rashaId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update program template RASHA item');
      return json.data as ProgramTemplateRasha;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: programTemplateRashaKeys.byTemplate(variables.templateId),
      });
      toast.success('RASHA item updated successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to update RASHA item');
    },
  });
}

export function useDeleteProgramTemplateRashaItem() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    Error,
    { templateId: number; rashaId: number }
  >({
    mutationFn: async ({ templateId, rashaId }) => {
      const res = await fetch(
        `/api/program-templates/${templateId}/rasha/${rashaId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to delete program template RASHA item');
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: programTemplateRashaKeys.byTemplate(variables.templateId),
      });
      toast.success('RASHA item removed from template successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to remove RASHA item from template');
    },
  });
}

