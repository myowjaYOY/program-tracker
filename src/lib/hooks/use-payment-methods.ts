import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { PaymentMethods } from '@/types/database.types';
import type { PaymentMethodsFormData } from '@/lib/validations/payment-methods';

const hooks = createEntityHooks<PaymentMethods, PaymentMethodsFormData, Partial<PaymentMethodsFormData>, string | number>({
    entityName: 'Payment method',
    endpoint: '/api/payment-methods',
    queryKey: 'payment-methods',
    idField: 'payment_method_id',
});

export const paymentMethodsKeys = hooks.keys;
export const usePaymentMethods = hooks.useList;
export const useActivePaymentMethods = hooks.useActive;
export const usePaymentMethodDetail = hooks.useDetail;
export const useCreatePaymentMethods = hooks.useCreate;
export const useUpdatePaymentMethods = hooks.useUpdate;
export const useDeletePaymentMethods = hooks.useDelete;
