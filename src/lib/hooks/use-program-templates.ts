import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramTemplate } from '@/types/database.types';

export const programTemplateKeys = {
  all: ['program-templates'] as const,
  list: () => [...programTemplateKeys.all, 'list'] as const,
  active: () => [...programTemplateKeys.all, 'active'] as const,
  detail: (id: number) => [...programTemplateKeys.all, 'detail', id] as const,
};

export function useProgramTemplates() {
  return useQuery<ProgramTemplate[], Error>({
    queryKey: programTemplateKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/program-templates', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program templates');
      return json.data as ProgramTemplate[];
    },
  });
}

export function useActiveProgramTemplates() {
  return useQuery<ProgramTemplate[], Error>({
    queryKey: programTemplateKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/program-templates?active=true', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          json.error || 'Failed to fetch active program templates'
        );
      return json.data as ProgramTemplate[];
    },
  });
}

export function useProgramTemplate(id: number) {
  return useQuery<ProgramTemplate, Error>({
    queryKey: programTemplateKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/program-templates/${id}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program template');
      return json.data as ProgramTemplate;
    },
    enabled: !!id,
  });
}

export function useCreateProgramTemplate() {
  const queryClient = useQueryClient();

  return useMutation<ProgramTemplate, Error, Partial<ProgramTemplate>>({
    mutationFn: async data => {
      const res = await fetch('/api/program-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create program template');
      return json.data as ProgramTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.all });
    },
  });
}

export function useUpdateProgramTemplate() {
  const queryClient = useQueryClient();

  return useMutation<
    ProgramTemplate,
    Error,
    { id: number; data: Partial<ProgramTemplate> }
  >({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/program-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update program template');
      return json.data as ProgramTemplate;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.all });
      queryClient.invalidateQueries({
        queryKey: programTemplateKeys.detail(data.program_template_id),
      });
    },
  });
}

export function useDeleteProgramTemplate() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async id => {
      const res = await fetch(`/api/program-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete program template');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: programTemplateKeys.all });
    },
  });
}
