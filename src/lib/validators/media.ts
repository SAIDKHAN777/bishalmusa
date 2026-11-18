import { z } from 'zod';

export const mediaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  resourceType: z.enum(['image', 'raw']).optional(),
  search: z.string().optional(),
});

export type MediaQueryInput = z.infer<typeof mediaQuerySchema>;

export const mediaUpdateSchema = z.object({
  altText: z.string().max(255, 'Alt text cannot exceed 255 characters').optional(),
});

export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
