import { useQuery } from '@tanstack/react-query';

export interface ProgramChangesPreviewItem {
  member_name: string;
  program_name: string;
  changed_at: string;
}

const coordinatorProgramChangesPreviewKeys = {
  all: ['coordinator-program-changes-preview'] as const,
  preview: () => [...coordinatorProgramChangesPreviewKeys.all, 'preview'] as const,
};

export function useCoordinatorProgramChangesPreview() {
  return useQuery<ProgramChangesPreviewItem[], Error>({
    queryKey: coordinatorProgramChangesPreviewKeys.preview(),
    queryFn: async () => {
      const res = await fetch(
        '/api/coordinator/program-changes?range=week&unique_only=true&limit=7',
        {
          credentials: 'include',
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch program changes preview');
      }
      return json.data as ProgramChangesPreviewItem[];
    },
    staleTime: 30 * 1000, // 30 seconds - short cache for responsiveness
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}
