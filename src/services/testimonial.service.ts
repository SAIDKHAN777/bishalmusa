import { db } from '../lib/db';
import { ApprovalStatus, type Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { createTestimonialSchema, updateTestimonialSchema } from '../lib/validators/content';

export class TestimonialService {
  static async list(approvedOnly = true, featuredOnly = false) {
    const where: Prisma.TestimonialWhereInput = { deletedAt: null };
    if (approvedOnly) where.status = ApprovalStatus.APPROVED;
    if (featuredOnly) where.featured = true;

    return db.testimonial.findMany({
      where,
      orderBy: [{ order: 'asc' }, { rating: 'desc' }, { createdAt: 'desc' }],
    });
  }

  static async getById(id: string) {
    return db.testimonial.findFirst({
      where: { id, deletedAt: null },
    });
  }

  static async create(data: z.infer<typeof createTestimonialSchema>) {
    return db.testimonial.create({ data });
  }

  static async update(id: string, data: z.infer<typeof updateTestimonialSchema>) {
    return db.testimonial.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return db.testimonial.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
