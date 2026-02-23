import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { TherapyType } from '@/types/database.types';
import type { TherapyTypeFormData } from '@/lib/validations/therapy-type';

const hooks = createEntityHooks<TherapyType, TherapyTypeFormData, Partial<TherapyTypeFormData>, string | number>({
    entityName: 'Therapy type',
    endpoint: '/api/therapy-type',
    queryKey: 'therapy-type',
    idField: 'therapy_type_id',
});

export const therapyTypeKeys = hooks.keys;
export const useTherapyTypes = hooks.useList;
export const useActiveTherapyTypes = hooks.useActive;
export const useTherapyTypeDetail = hooks.useDetail;
export const useCreateTherapyType = hooks.useCreate;
export const useUpdateTherapyType = hooks.useUpdate;
export const useDeleteTherapyType = hooks.useDelete;
