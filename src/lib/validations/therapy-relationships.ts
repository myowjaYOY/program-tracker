import { z } from 'zod';

export const therapyRelationshipSchema = z.object({
  therapy_id: z.number().positive(),
  body_id: z.number().positive(),
  pillar_id: z.number().positive(),
  active_flag: z.boolean().default(true),
});

export const therapyRelationshipUpdateSchema =
  therapyRelationshipSchema.partial();

export type TherapyRelationshipFormData = z.infer<
  typeof therapyRelationshipSchema
>;
export type TherapyRelationshipUpdateData = z.infer<
  typeof therapyRelationshipUpdateSchema
>;
