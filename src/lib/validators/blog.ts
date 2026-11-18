import { z } from 'zod';
import { Status } from '@prisma/client';

export const blogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  tag: z.string().optional(),
  status: z.nativeEnum(Status).optional(),
});

export type BlogQuery = z.infer<typeof blogQuerySchema>;

export const createBlogPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().max(200).optional(),
  summary: z.string().max(500).optional().nullable(),
  content: z.string().min(1, 'Content is required'),
  coverImageUrl: z.string().url().optional().nullable(),
  status: z.nativeEnum(Status).default(Status.DRAFT),
  publishedAt: z.coerce.date().optional().nullable(),
  tags: z.array(z.string()).default([]),
  metaTitle: z.string().max(100).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  canonicalUrl: z.string().url().optional().nullable(),
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export const updateBlogPostSchema = createBlogPostSchema.partial();
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;

export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
  slug: z.string().max(50).optional(),
});

export const updateTagSchema = createTagSchema.partial();
