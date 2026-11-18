import { db } from '../lib/db';
import type { z } from 'zod';
import type { createExperienceSchema, updateExperienceSchema } from '../lib/validators/content';

export class ExperienceService {
  static async list() {
    return db.experience.findMany({
      where: { deletedAt: null },
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }],
    });
  }

  static async getById(id: string) {
    return db.experience.findFirst({
      where: { id, deletedAt: null },
    });
  }

  static async create(data: z.infer<typeof createExperienceSchema>) {
    return db.experience.create({ data });
  }

  static async update(id: string, data: z.infer<typeof updateExperienceSchema>) {
    return db.experience.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return db.experience.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
