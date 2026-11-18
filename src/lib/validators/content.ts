import { z } from 'zod';
import { Status, ApprovalStatus } from '@prisma/client';

// Common Pagination & Filtering Query Schema
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  featured: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  status: z.nativeEnum(Status).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// Category Schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// Project Schemas
export const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().min(1, 'Slug is required').max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  summary: z.string().min(1, 'Summary is required').max(500),
  description: z.string().min(1, 'Description is required'),
  coverImageUrl: z.string().url().optional().nullable(),
  demoUrl: z.string().url().optional().nullable(),
  githubUrl: z.string().url().optional().nullable(),
  featured: z.boolean().default(false),
  status: z.nativeEnum(Status).default(Status.DRAFT),
  order: z.number().int().default(0),
  categoryId: z.string().cuid().optional().nullable(),
  tags: z.array(z.string()).default([]),
});

export const updateProjectSchema = createProjectSchema.partial();

// Skill Schemas
export const createSkillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.string().min(1, 'Category is required').max(100),
  proficiencyLevel: z.number().int().min(1).max(100).default(80),
  iconUrl: z.string().url().optional().nullable(),
  featured: z.boolean().default(false),
  order: z.number().int().default(0),
});

export const updateSkillSchema = createSkillSchema.partial();

// Service Schemas
export const createServiceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().min(1, 'Slug is required').max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().min(1, 'Description is required'),
  icon: z.string().optional().nullable(),
  features: z.array(z.string()).default([]),
  order: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateServiceSchema = createServiceSchema.partial();

// Experience Schemas
export const createExperienceSchema = z.object({
  company: z.string().min(1, 'Company is required').max(200),
  role: z.string().min(1, 'Role is required').max(200),
  location: z.string().max(200).optional().nullable(),
  employmentType: z.string().default('Full-time'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  isCurrent: z.boolean().default(false),
  description: z.string().min(1, 'Description is required'),
  technologies: z.array(z.string()).default([]),
  order: z.number().int().default(0),
});

export const updateExperienceSchema = createExperienceSchema.partial();

// Education Schemas
export const createEducationSchema = z.object({
  institution: z.string().min(1, 'Institution is required').max(200),
  degree: z.string().min(1, 'Degree is required').max(200),
  fieldOfStudy: z.string().max(200).optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  activities: z.string().optional().nullable(),
  order: z.number().int().default(0),
});

export const updateEducationSchema = createEducationSchema.partial();

// Testimonial Schemas
export const createTestimonialSchema = z.object({
  authorName: z.string().min(1, 'Author name is required').max(100),
  authorTitle: z.string().min(1, 'Author title is required').max(100),
  authorCompany: z.string().max(100).optional().nullable(),
  authorAvatarUrl: z.string().url().optional().nullable(),
  content: z.string().min(1, 'Content is required'),
  rating: z.number().int().min(1).max(5).default(5),
  featured: z.boolean().default(false),
  status: z.nativeEnum(ApprovalStatus).default(ApprovalStatus.APPROVED),
  order: z.number().int().default(0),
});

export const updateTestimonialSchema = createTestimonialSchema.partial();

// SiteSetting Schemas
export const updateSiteSettingSchema = z.object({
  siteName: z.string().min(1).max(100).optional(),
  tagline: z.string().max(200).optional().nullable(),
  bio: z.string().optional().nullable(),
  contactEmail: z.string().email().optional(),
  socialLinks: z.record(z.string()).optional().nullable(),
  seoTitle: z.string().max(100).optional().nullable(),
  seoDescription: z.string().max(300).optional().nullable(),
  resumeUrl: z.string().url().optional().nullable(),
  turnstileEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
});
