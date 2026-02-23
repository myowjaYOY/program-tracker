import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import { useQuery } from '@tanstack/react-query';
import type { ProgramStatus } from '@/types/database.types';
import type { ProgramStatusFormData } from '@/lib/validations/program-status';

const hooks = createEntityHooks<ProgramStatus, ProgramStatusFormData, Partial<ProgramStatusFormData>, string | number>({
    entityName: 'Program status',
    endpoint: '/api/program-status',
    queryKey: 'program-status',
    idField: 'program_status_id',
});

export const programStatusKeys = hooks.keys;
export const useProgramStatus = hooks.useList;
export const useProgramStatusDetail = hooks.useDetail;
export const useCreateProgramStatus = hooks.useCreate;
export const useUpdateProgramStatus = hooks.useUpdate;
export const useDeleteProgramStatus = hooks.useDelete;

// Override useActive to add custom sorting
export function useActiveProgramStatus() {
    return useQuery<ProgramStatus[], Error>({
        queryKey: hooks.keys.active(),
        queryFn: async () => {
            const res = await fetch('/api/program-status');
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error || 'Failed to fetch program status');
            return (json.data as ProgramStatus[])
                .filter(ps => ps.active_flag)
                .sort((a, b) =>
                    a.status_name.localeCompare(b.status_name, undefined, {
                        sensitivity: 'accent',
                    })
                );
        },
    });
}
