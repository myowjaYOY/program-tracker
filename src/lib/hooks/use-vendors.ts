import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { Vendors } from '@/types/database.types';
import type { VendorFormData } from '@/lib/validations/vendor';

const hooks = createEntityHooks<Vendors, VendorFormData, Partial<VendorFormData>, string | number>({
    entityName: 'Vendor',
    endpoint: '/api/vendors',
    queryKey: 'vendors',
    idField: 'vendor_id',
});

export const vendorKeys = hooks.keys;
export const useVendors = (options?: { initialData?: Vendors[] | undefined }) => hooks.useList(options);
export const useActiveVendors = hooks.useActive;
export const useVendorDetail = hooks.useDetail;
export const useCreateVendor = hooks.useCreate;
export const useUpdateVendor = hooks.useUpdate;
export const useDeleteVendor = hooks.useDelete;
