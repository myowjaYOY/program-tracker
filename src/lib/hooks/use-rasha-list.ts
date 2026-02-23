import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { RashaList } from '@/types/database.types';
import type { RashaListFormData } from '@/lib/validations/rasha-list';

const hooks = createEntityHooks<RashaList, RashaListFormData, Partial<RashaListFormData>, string | number>({
    entityName: 'RASHA item',
    endpoint: '/api/rasha-list',
    queryKey: 'rasha-list',
    idField: 'rasha_list_id',
});

export const rashaListKeys = hooks.keys;
export const useRashaLists = hooks.useList;
export const useActiveRashaLists = hooks.useActive;
export const useRashaListDetail = hooks.useDetail;
export const useCreateRashaList = hooks.useCreate;
export const useUpdateRashaList = hooks.useUpdate;
export const useDeleteRashaList = hooks.useDelete;
