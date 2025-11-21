import { z } from 'zod';

export const leadNoteSchema = z.object({
  lead_id: z.number().int().positive('Lead ID must be a positive integer'),
  note_type: z.enum(['Challenge', 'Follow-Up', 'Other', 'PME', 'Win'], {
    required_error: 'Note type is required',
  }),
  note: z.string().min(1, 'Note content is required').max(2000, 'Note content cannot exceed 2000 characters'),
});

export const leadNoteUpdateSchema = leadNoteSchema.partial();

export type LeadNoteFormData = z.infer<typeof leadNoteSchema>;
export type LeadNoteUpdateData = z.infer<typeof leadNoteUpdateSchema>;
