import { db } from '../lib/db';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createServiceSchema, updateServiceSchema } from '../lib/validators/content';

export class ServiceService {
  static async list(activeOnly = true) {
    const where: Prisma.ServiceWhereInput = { deletedAt: null };
    if (activeOnly) where.active = true;

    return db.service.findMany({
      where,
      orderBy: { order: 'asc' },
    });
  }

  static async getById(id: string) {
    return db.service.findFirst({
      where: { id, deletedAt: null },
    });
  }

  static async getBySlug(slug: string) {
    return db.service.findFirst({
      where: { slug, deletedAt: null },
    });
  }

  static async create(data: z.infer<typeof createServiceSchema>) {
    return db.service.create({ data });
  }

  static async update(id: string, data: z.infer<typeof updateServiceSchema>) {
    return db.service.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return db.service.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
