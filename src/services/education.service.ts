import { db } from '../lib/db';
import type { z } from 'zod';
import type { createEducationSchema, updateEducationSchema } from '../lib/validators/content';

export class EducationService {
  static async list() {
    return db.education.findMany({
      where: { deletedAt: null },
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }],
    });
  }

  static async getById(id: string) {
    return db.education.findFirst({
      where: { id, deletedAt: null },
    });
  }

  static async create(data: z.infer<typeof createEducationSchema>) {
    return db.education.create({ data });
  }

  static async update(id: string, data: z.infer<typeof updateEducationSchema>) {
    return db.education.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return db.education.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
