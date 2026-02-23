import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { Status } from '@/types/database.types';
import type { StatusFormData } from '@/lib/validations/status';

const hooks = createEntityHooks<Status, StatusFormData, Partial<StatusFormData>, string | number>({
    entityName: 'Status',
    endpoint: '/api/status',
    queryKey: 'status',
    idField: 'status_id',
});

export const statusKeys = hooks.keys;
export const useStatus = hooks.useList;
export const useActiveStatus = hooks.useActive;
export const useStatusDetail = hooks.useDetail;
export const useCreateStatus = hooks.useCreate;
export const useUpdateStatus = hooks.useUpdate;
export const useDeleteStatus = hooks.useDelete;
