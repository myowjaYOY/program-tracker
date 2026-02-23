import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { FinancingTypes } from '@/types/database.types';
import type { FinancingTypesFormData } from '@/lib/validations/financing-types';

const hooks = createEntityHooks<FinancingTypes, FinancingTypesFormData, Partial<FinancingTypesFormData>, string | number>({
    entityName: 'Financing type',
    endpoint: '/api/financing-types',
    queryKey: 'financing-types',
    idField: 'financing_type_id',
});

export const financingTypesKeys = hooks.keys;
export const useFinancingTypes = hooks.useList;
export const useActiveFinancingTypes = hooks.useActive;
export const useFinancingTypeDetail = hooks.useDetail;
export const useCreateFinancingTypes = hooks.useCreate;
export const useUpdateFinancingTypes = hooks.useUpdate;
export const useDeleteFinancingTypes = hooks.useDelete;
