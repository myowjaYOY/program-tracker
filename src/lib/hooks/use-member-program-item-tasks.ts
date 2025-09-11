import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MemberProgramItemTasks } from '@/types/database.types';
import {
  MemberProgramItemTaskFormData,
  MemberProgramItemTaskUpdateData,
} from '@/lib/validations/member-program-item-task';

// Query keys
export const memberProgramItemTaskKeys = {
  all: ['member-program-item-tasks'] as const,
  byProgram: (programId: number) =>
    [...memberProgramItemTaskKeys.all, 'program', programId] as const,
  byItem: (itemId: number) =>
    [...memberProgramItemTaskKeys.all, 'item', itemId] as const,
};

// Fetch all tasks for a member program
export function useMemberProgramItemTasks(programId: number) {
  return useQuery({
    queryKey: memberProgramItemTaskKeys.byProgram(programId),
    queryFn: async (): Promise<MemberProgramItemTasks[]> => {
      const response = await fetch(`/api/member-programs/${programId}/tasks`);
      if (!response.ok) {
        throw new Error('Failed to fetch member program item tasks');
      }
      const result = await response.json();
      return result.data;
    },
    enabled: !!programId,
  });
}

// Create a new task
export function useCreateMemberProgramItemTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      programId,
      data,
    }: {
      programId: number;
      data: MemberProgramItemTaskFormData;
    }) => {
      const response = await fetch(`/api/member-programs/${programId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || 'Failed to create member program item task'
        );
      }

      return response.json();
    },
    onSuccess: (_, { programId }) => {
      queryClient.invalidateQueries({
        queryKey: memberProgramItemTaskKeys.byProgram(programId),
      });
      toast.success('Task created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Update a task
export function useUpdateMemberProgramItemTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      programId,
      taskId,
      data,
    }: {
      programId: number;
      taskId: number;
      data: MemberProgramItemTaskUpdateData;
    }) => {
      const response = await fetch(
        `/api/member-programs/${programId}/tasks/${taskId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || 'Failed to update member program item task'
        );
      }

      return response.json();
    },
    onSuccess: (_, { programId }) => {
      queryClient.invalidateQueries({
        queryKey: memberProgramItemTaskKeys.byProgram(programId),
      });
      toast.success('Task updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete a task
export function useDeleteMemberProgramItemTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      programId,
      taskId,
    }: {
      programId: number;
      taskId: number;
    }) => {
      const response = await fetch(
        `/api/member-programs/${programId}/tasks/${taskId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || 'Failed to delete member program item task'
        );
      }

      return response.json();
    },
    onSuccess: (_, { programId }) => {
      queryClient.invalidateQueries({
        queryKey: memberProgramItemTaskKeys.byProgram(programId),
      });
      toast.success('Task deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
