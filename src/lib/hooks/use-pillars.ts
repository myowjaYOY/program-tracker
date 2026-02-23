import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { Pillars } from '@/types/database.types';
import type { PillarFormData } from '@/lib/validations/pillar';

const hooks = createEntityHooks<Pillars, PillarFormData, Partial<PillarFormData>, string | number>({
    entityName: 'Pillar',
    endpoint: '/api/pillars',
    queryKey: 'pillars',
    idField: 'pillar_id',
});

export const pillarKeys = hooks.keys;
export const usePillars = hooks.useList;
export const useActivePillars = hooks.useActive;
export const usePillarDetail = hooks.useDetail;
export const useCreatePillar = hooks.useCreate;
export const useUpdatePillar = hooks.useUpdate;
export const useDeletePillar = hooks.useDelete;
