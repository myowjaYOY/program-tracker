import { useQuery } from '@tanstack/react-query';

export interface PausedProgramPreviewItem {
  member_name: string;
  program_name: string;
  member_program_id: number;
}

const pausedProgramsPreviewKeys = {
  all: ['paused-programs-preview'] as const,
  preview: () => [...pausedProgramsPreviewKeys.all, 'preview'] as const,
};

export function usePausedProgramsPreview() {
  return useQuery<PausedProgramPreviewItem[], Error>({
    queryKey: pausedProgramsPreviewKeys.preview(),
    queryFn: async () => {
      const res = await fetch('/api/member-programs', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch paused programs');
      }
      
      // Filter for paused programs and map to preview format
      const pausedPrograms = (json.data || [])
        .filter((p: any) => p.status_name?.toLowerCase() === 'paused')
        .map((p: any) => ({
          member_name: p.lead_name || 'Unknown Member',
          program_name: p.program_template_name || p.template_name || 'Unknown Program',
          member_program_id: p.member_program_id,
        }));
      
      return pausedPrograms as PausedProgramPreviewItem[];
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}



