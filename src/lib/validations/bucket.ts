import { z } from 'zod';

export const bucketSchema = z.object({
  bucket_name: z.string().min(1, 'Bucket name is required'),
  description: z.string().optional().or(z.literal('')),
  active_flag: z.boolean().optional().default(true),
});

export const bucketUpdateSchema = bucketSchema.partial();

export type BucketFormData = z.infer<typeof bucketSchema>;
export type BucketUpdateData = z.infer<typeof bucketUpdateSchema> & {
  id: string;
};
