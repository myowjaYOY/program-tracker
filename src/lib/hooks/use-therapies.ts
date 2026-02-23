import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { Therapies } from '@/types/database.types';
import type { TherapyFormData } from '@/lib/validations/therapy';

const hooks = createEntityHooks<Therapies, TherapyFormData, Partial<TherapyFormData>, string | number>({
    entityName: 'Therapy',
    endpoint: '/api/therapies',
    queryKey: 'therapies',
    idField: 'therapy_id',
});

export const therapyKeys = hooks.keys;
export const useTherapies = hooks.useList;
export const useActiveTherapies = hooks.useActive;
export const useTherapyDetail = hooks.useDetail;
export const useCreateTherapy = hooks.useCreate;
export const useUpdateTherapy = hooks.useUpdate;
export const useDeleteTherapy = hooks.useDelete;
