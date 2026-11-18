import { db } from '../lib/db';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createSkillSchema, updateSkillSchema } from '../lib/validators/content';

export class SkillService {
  static async list(featuredOnly = false) {
    const where: Prisma.SkillWhereInput = { deletedAt: null };
    if (featuredOnly) where.featured = true;

    return db.skill.findMany({
      where,
      orderBy: [{ order: 'asc' }, { proficiencyLevel: 'desc' }],
    });
  }

  static async getById(id: string) {
    return db.skill.findFirst({
      where: { id, deletedAt: null },
    });
  }

  static async create(data: z.infer<typeof createSkillSchema>) {
    return db.skill.create({ data });
  }

  static async update(id: string, data: z.infer<typeof updateSkillSchema>) {
    return db.skill.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return db.skill.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
