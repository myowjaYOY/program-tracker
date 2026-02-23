import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { Buckets } from '@/types/database.types';
import type { BucketFormData } from '@/lib/validations/bucket';

const hooks = createEntityHooks<Buckets, BucketFormData, Partial<BucketFormData>, string | number>({
    entityName: 'Bucket',
    endpoint: '/api/buckets',
    queryKey: 'buckets',
    idField: 'bucket_id',
    activeFilterServerSide: true,
});

export const bucketKeys = hooks.keys;
export const useBuckets = hooks.useList;
export const useActiveBuckets = hooks.useActive;
export const useBucketDetail = hooks.useDetail;
export const useCreateBucket = hooks.useCreate;
export const useUpdateBucket = hooks.useUpdate;
export const useDeleteBucket = hooks.useDelete;
