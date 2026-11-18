import { z } from 'zod';

export const pageViewSchema = z.object({
  path: z.string().min(1, 'Path is required').max(500).default('/'),
  referrer: z.string().max(1000).nullable().optional(),
});

export type PageViewInput = z.infer<typeof pageViewSchema>;

export const projectClickSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  type: z.enum(['DEMO', 'GITHUB']).default('DEMO'),
});

export type ProjectClickInput = z.infer<typeof projectClickSchema>;

export const analyticsStatsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

export type AnalyticsStatsQueryInput = z.infer<typeof analyticsStatsQuerySchema>;
