import { z } from 'zod';

export const exportOptionsSchema = z.object({
  memberId: z.number().min(1, 'Member ID is required'),
  format: z.enum(['pdf', 'html']).default('pdf'),
  sections: z.object({
    memberProgress: z.boolean().default(true),
    msqAssessment: z.boolean().default(false),
    promisAssessment: z.boolean().default(false),
  }),
  dateRange: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
  includeCharts: z.boolean().default(true),
  includeInterpretation: z.boolean().default(true),
  delivery: z.enum(['download', 'email']).default('download'),
  recipientEmail: z.string().email().optional(),
});

export type ExportOptions = z.infer<typeof exportOptionsSchema>;





