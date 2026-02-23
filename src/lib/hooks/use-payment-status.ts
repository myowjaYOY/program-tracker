import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { PaymentStatus } from '@/types/database.types';
import type { PaymentStatusFormData } from '@/lib/validations/payment-status';

const hooks = createEntityHooks<PaymentStatus, PaymentStatusFormData, Partial<PaymentStatusFormData>, string | number>({
    entityName: 'Payment status',
    endpoint: '/api/payment-status',
    queryKey: 'payment-status',
    idField: 'payment_status_id',
});

export const paymentStatusKeys = hooks.keys;
export const usePaymentStatus = hooks.useList;
export const useActivePaymentStatus = hooks.useActive;
export const usePaymentStatusDetail = hooks.useDetail;
export const useCreatePaymentStatus = hooks.useCreate;
export const useUpdatePaymentStatus = hooks.useUpdate;
export const useDeletePaymentStatus = hooks.useDelete;
