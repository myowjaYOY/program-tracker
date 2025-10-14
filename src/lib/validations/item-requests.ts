import { z } from 'zod';

// Schema for creating a new item request
export const itemRequestSchema = z.object({
  lead_id: z.number().int().positive().nullable().optional(),
  item_description: z
    .string()
    .min(1, 'Item description is required')
    .max(500, 'Item description must be less than 500 characters'),
  quantity: z
    .number()
    .int()
    .min(1, 'Quantity must be at least 1')
    .max(1000, 'Quantity must be less than 1000'),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .nullable()
    .optional(),
});

// Schema for updating an existing item request (all fields optional except for validations)
export const itemRequestUpdateSchema = itemRequestSchema.partial();

// Schema for cancelling an item request
export const cancelItemRequestSchema = z.object({
  cancellation_reason: z
    .string()
    .min(1, 'Cancellation reason is required')
    .max(500, 'Cancellation reason must be less than 500 characters'),
});

// Infer TypeScript types from schemas
export type ItemRequestFormData = z.infer<typeof itemRequestSchema>;
export type ItemRequestUpdateData = z.infer<typeof itemRequestUpdateSchema>;
export type CancelItemRequestData = z.infer<typeof cancelItemRequestSchema>;



