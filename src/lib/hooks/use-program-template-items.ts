import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramTemplateItems } from '@/types/database.types';
import { programTemplateKeys } from './use-program-templates';

export const programTemplateItemKeys = {
  all: ['program-template-items'] as const,
  list: () => [...programTemplateItemKeys.all, 'list'] as const,
  byTemplate: (templateId: number) => [...programTemplateItemKeys.all, 'by-template', templateId] as const,
  detail: (id: number) => [...programTemplateItemKeys.all, 'detail', id] as const,
};

export function useProgramTemplateItems(templateId: number) {
  return useQuery<ProgramTemplateItems[], Error>({
    queryKey: programTemplateItemKeys.byTemplate(templateId),
    queryFn: async () => {
      const res = await fetch(`/api/program-templates/${templateId}/items`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch program template items');
      return json.data as ProgramTemplateItems[];
    },
    enabled: !!templateId,
  });
}

export function useCreateProgramTemplateItem() {
  const queryClient = useQueryClient();
  
  return useMutation<ProgramTemplateItems, Error, Partial<ProgramTemplateItems> & { program_template_id: number }>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/program-templates/${data.program_template_id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create program template item');
      return json.data as ProgramTemplateItems;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: programTemplateItemKeys.byTemplate(data.program_template_id) });
      // Also invalidate the program template to update calculated fields
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.detail(data.program_template_id) });
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.list() });
    },
  });
}

export function useUpdateProgramTemplateItem() {
  const queryClient = useQueryClient();
  
  return useMutation<ProgramTemplateItems, Error, { templateId: number; itemId: number; data: Partial<ProgramTemplateItems> }>({
    mutationFn: async ({ templateId, itemId, data }) => {
      const res = await fetch(`/api/program-templates/${templateId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update program template item');
      return json.data as ProgramTemplateItems;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: programTemplateItemKeys.byTemplate(variables.templateId) });
      queryClient.invalidateQueries({ queryKey: programTemplateItemKeys.detail(variables.itemId) });
      // Also invalidate the program template to update calculated fields
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.detail(variables.templateId) });
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.list() });
    },
  });
}

export function useDeleteProgramTemplateItem() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, { templateId: number; itemId: number }>({
    mutationFn: async ({ templateId, itemId }) => {
      console.log(`Making DELETE request to /api/program-templates/${templateId}/items/${itemId}`);
      const res = await fetch(`/api/program-templates/${templateId}/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      console.log('DELETE response status:', res.status);
      if (!res.ok) {
        const json = await res.json();
        console.error('DELETE request failed:', json);
        throw new Error(json.error || 'Failed to delete program template item');
      }
      console.log('DELETE request successful');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: programTemplateItemKeys.byTemplate(variables.templateId) });
      queryClient.invalidateQueries({ queryKey: programTemplateItemKeys.detail(variables.itemId) });
      // Also invalidate the program template to update calculated fields
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.detail(variables.templateId) });
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.list() });
    },
  });
}
