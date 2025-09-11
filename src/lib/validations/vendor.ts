import { z } from 'zod';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

export const vendorSchema = z.object({
  vendor_name: z.string().min(1, 'Vendor name is required'),
  contact_person: z.string().min(1, 'Contact person is required'),
  phone: z
    .string()
    .min(1, 'Phone is required')
    .refine(
      val => {
        const digits = val.replace(/\D/g, '');
        return digits.length === 10;
      },
      { message: 'Invalid phone number' }
    ),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  active_flag: z.boolean().optional(),
});

export type VendorFormData = z.infer<typeof vendorSchema>;
export type VendorUpdateData = Partial<VendorFormData> & { id: string };
