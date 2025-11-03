import { z } from 'zod';

export const purchaseOrderItemSchema = z.object({
  therapy_id: z.number().int().positive('Therapy ID is required'),
  quantity_ordered: z.number().int().min(1, 'Quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Unit cost cannot be negative'),
});

export const purchaseOrderSchema = z.object({
  status: z.enum(['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled']),
  expected_delivery_date: z.string().optional().nullable(),
  tax_amount: z.number().min(0, 'Tax amount cannot be negative'),
  shipping_cost: z.number().min(0, 'Shipping cost cannot be negative'),
  order_notes: z.string().optional().nullable(),
  purchase_order_items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required'),
});

export type PurchaseOrderItemFormData = z.infer<typeof purchaseOrderItemSchema>;
export type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderUpdateData = Partial<PurchaseOrderFormData> & { po_id: number };
