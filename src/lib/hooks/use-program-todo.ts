import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const todoKeys = {
  all: ['program-todo'] as const,
  lists: (programId: number) => [...todoKeys.all, programId] as const,
};

export function useProgramToDo(programId: number) {
  return useQuery({
    queryKey: todoKeys.lists(programId),
    queryFn: async () => {
      const res = await fetch(`/api/member-programs/${programId}/todo`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch to-do tasks');
      return json.data || [];
    },
  });
}

export function useUpdateToDo(programId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskScheduleId: number; completed_flag: boolean }) => {
      const res = await fetch(`/api/member-programs/${programId}/todo/${input.taskScheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed_flag: input.completed_flag }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update task schedule');
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: todoKeys.lists(programId) });
    },
  });
}


