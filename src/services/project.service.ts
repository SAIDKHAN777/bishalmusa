import { db } from '../lib/db';
import { Status, type Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createProjectSchema, updateProjectSchema, PaginationQuery } from '../lib/validators/content';

export class ProjectService {
  static async list(params: PaginationQuery & { isAdmin?: boolean }) {
    const { page = 1, limit = 20, search, category, featured, status, isAdmin = false } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
    };

    if (!isAdmin) {
      where.status = Status.PUBLISHED;
    } else if (status) {
      where.status = status;
    }

    if (featured !== undefined) {
      where.featured = featured;
    }

    if (category) {
      where.category = {
        slug: category,
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      db.project.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.project.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getBySlug(slug: string, incrementView = true) {
    const project = await db.project.findFirst({
      where: { slug, deletedAt: null },
      include: {
        category: true,
      },
    });

    if (!project) return null;

    if (incrementView && project.status === Status.PUBLISHED) {
      await db.project.update({
        where: { id: project.id },
        data: { viewsCount: { increment: 1 } },
      });
      project.viewsCount += 1;
    }

    return project;
  }

  static async getById(id: string) {
    return db.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
      },
    });
  }

  static async create(data: z.infer<typeof createProjectSchema>) {
    return db.project.create({
      data,
      include: {
        category: true,
      },
    });
  }

  static async update(id: string, data: z.infer<typeof updateProjectSchema>) {
    return db.project.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });
  }

  static async delete(id: string) {
    return db.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
