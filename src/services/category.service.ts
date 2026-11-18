import { db } from '../lib/db';
import type { z } from 'zod';
import type { createCategorySchema, updateCategorySchema } from '../lib/validators/content';

export class CategoryService {
  static async list() {
    return db.category.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async getById(id: string) {
    return db.category.findFirst({
      where: { id, deletedAt: null },
      include: { projects: true },
    });
  }

  static async getBySlug(slug: string) {
    return db.category.findFirst({
      where: { slug, deletedAt: null },
      include: { projects: true },
    });
  }

  static async create(data: z.infer<typeof createCategorySchema>) {
    return db.category.create({ data });
  }

  static async update(id: string, data: z.infer<typeof updateCategorySchema>) {
    return db.category.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return db.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
