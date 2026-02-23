import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { Bodies } from '@/types/database.types';
import type { BodyFormData } from '@/lib/validations/body';

const hooks = createEntityHooks<Bodies, BodyFormData, Partial<BodyFormData>, string | number>({
    entityName: 'Body',
    endpoint: '/api/bodies',
    queryKey: 'bodies',
    idField: 'body_id',
});

export const bodyKeys = hooks.keys;
export const useBodies = hooks.useList;
export const useActiveBodies = hooks.useActive;
export const useBodyDetail = hooks.useDetail;
export const useCreateBody = hooks.useCreate;
export const useUpdateBody = hooks.useUpdate;
export const useDeleteBody = hooks.useDelete;
