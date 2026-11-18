import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  email: z
    .string()
    .email('Please provide a valid email address')
    .max(150, 'Email must not exceed 150 characters')
    .trim()
    .toLowerCase(),
  subject: z
    .string()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject must not exceed 200 characters')
    .trim(),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must not exceed 5000 characters')
    .trim(),
  website_url_check: z.string().optional().default(''), // Honeypot field: bots fill this in
  turnstileToken: z.string().optional(),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const messageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  isRead: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }),
  isSpam: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }),
});

export type MessageQueryInput = z.infer<typeof messageQuerySchema>;

export const messageUpdateSchema = z.object({
  isRead: z.boolean().optional(),
  isSpam: z.boolean().optional(),
});

export type MessageUpdateInput = z.infer<typeof messageUpdateSchema>;
