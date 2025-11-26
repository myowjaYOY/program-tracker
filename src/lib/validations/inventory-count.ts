import { z } from 'zod';

// ============================================================================
// Count Session Schemas
// ============================================================================

export const countSessionSchema = z.object({
  session_number: z.string().optional(),
  session_date: z.string().min(1, 'Session date is required'),
  count_type: z.enum(['cycle', 'full', 'custom'], {
    errorMap: () => ({ message: 'Invalid count type' }),
  }),
  status: z.enum(['in_progress', 'completed', 'cancelled']).default('in_progress'),
  counted_by: z.string().uuid().optional(),
  completed_at: z.string().optional(),
  notes: z.string().optional().or(z.literal('')),
  items_total: z.number().int().min(0).default(0),
  items_counted: z.number().int().min(0).default(0),
  items_with_variance: z.number().int().min(0).default(0),
  items_pending_approval: z.number().int().min(0).default(0),
});

export const countSessionUpdateSchema = countSessionSchema.partial();

export type CountSessionFormData = z.infer<typeof countSessionSchema>;
export type CountSessionUpdateData = z.infer<typeof countSessionUpdateSchema>;

// ============================================================================
// Count Detail Schemas
// ============================================================================

export const countDetailSchema = z.object({
  count_session_id: z.number().int().positive('Count session ID is required'),
  inventory_item_id: z.number().int().positive('Inventory item ID is required'),
  expected_quantity: z.number().int().min(0, 'Expected quantity must be 0 or greater'),
  physical_quantity: z.number().int().min(0, 'Physical quantity must be 0 or greater').optional(),
  notes: z.string().optional().or(z.literal('')),
  requires_approval: z.boolean().default(false),
  status: z.enum(['pending', 'counted', 'approved', 'rejected', 'posted']).default('pending'),
});

export const countDetailUpdateSchema = countDetailSchema.partial().extend({
  count_detail_id: z.number().int().positive(),
});

export const countDetailBatchUpdateSchema = z.object({
  count_session_id: z.number().int().positive(),
  updates: z.array(
    z.object({
      count_detail_id: z.number().int().positive(),
      physical_quantity: z.number().int().min(0),
      notes: z.string().optional(),
    })
  ),
});

export type CountDetailFormData = z.infer<typeof countDetailSchema>;
export type CountDetailUpdateData = z.infer<typeof countDetailUpdateSchema>;
export type CountDetailBatchUpdateData = z.infer<typeof countDetailBatchUpdateSchema>;

// ============================================================================
// Approval Schemas
// ============================================================================

export const varianceApprovalSchema = z.object({
  count_detail_id: z.number().int().positive(),
  approved: z.boolean(),
  notes: z.string().optional().or(z.literal('')),
});

export const batchVarianceApprovalSchema = z.object({
  count_session_id: z.number().int().positive(),
  approvals: z.array(varianceApprovalSchema),
});

export type VarianceApprovalData = z.infer<typeof varianceApprovalSchema>;
export type BatchVarianceApprovalData = z.infer<typeof batchVarianceApprovalSchema>;

// ============================================================================
// Start Count Session Schema
// ============================================================================

export const startCountSessionSchema = z.object({
  count_type: z.enum(['cycle', 'full', 'custom']),
  session_date: z.string().min(1, 'Session date is required'),
  notes: z.string().optional().or(z.literal('')),
  selected_item_ids: z.array(z.number().int().positive()).optional(), // For custom counts
});

export type StartCountSessionData = z.infer<typeof startCountSessionSchema>;




















