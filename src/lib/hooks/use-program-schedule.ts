import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const scheduleKeys = {
  all: ['program-schedule'] as const,
  lists: (programId: number) => [...scheduleKeys.all, programId] as const,
};

export function useProgramSchedule(programId: number) {
  return useQuery({
    queryKey: scheduleKeys.lists(programId),
    queryFn: async () => {
      const res = await fetch(`/api/member-programs/${programId}/schedule`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch schedule');
      return json.data || [];
    },
  });
}

export function useUpdateSchedule(programId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      scheduleId: number;
      completed_flag: boolean;
    }) => {
      const res = await fetch(
        `/api/member-programs/${programId}/schedule/${input.scheduleId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ completed_flag: input.completed_flag }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update schedule');
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scheduleKeys.lists(programId) });
    },
  });
}
