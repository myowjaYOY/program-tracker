import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import { useQuery } from '@tanstack/react-query';
import type { ProgramRoles } from '@/types/database.types';
import type { ProgramRolesFormData } from '@/lib/validations/program-roles';

const hooks = createEntityHooks<ProgramRoles, ProgramRolesFormData, Partial<ProgramRolesFormData>, string | number>({
    entityName: 'Program role',
    endpoint: '/api/program-roles',
    queryKey: 'program-roles',
    idField: 'program_role_id',
});

export const programRolesKeys = hooks.keys;
export const useProgramRoles = hooks.useList;
export const useProgramRoleDetail = hooks.useDetail;
export const useCreateProgramRole = hooks.useCreate;
export const useUpdateProgramRole = hooks.useUpdate;
export const useDeleteProgramRole = hooks.useDelete;

// Override useActive to add custom sorting
export function useActiveProgramRoles() {
    return useQuery<ProgramRoles[], Error>({
        queryKey: hooks.keys.active(),
        queryFn: async () => {
            const res = await fetch('/api/program-roles');
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error || 'Failed to fetch program roles');
            return (json.data as ProgramRoles[])
                .filter(pr => pr.active_flag)
                .sort((a, b) => a.display_order - b.display_order);
        },
    });
}
