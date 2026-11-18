import { db } from '../lib/db';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { updateSiteSettingSchema } from '../lib/validators/content';

export class SettingService {
  static async get() {
    let settings = await db.siteSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await db.siteSetting.create({
        data: {
          id: 'default',
          siteName: 'Said Khan Portfolio',
          contactEmail: 'admin@saidkhan.dev',
        },
      });
    }

    return settings;
  }

  static async getPublic() {
    const settings = await this.get();
    return {
      siteName: settings.siteName,
      tagline: settings.tagline,
      bio: settings.bio,
      contactEmail: settings.contactEmail,
      socialLinks: settings.socialLinks,
      seoTitle: settings.seoTitle,
      seoDescription: settings.seoDescription,
      resumeUrl: settings.resumeUrl,
      maintenanceMode: settings.maintenanceMode,
    };
  }

  static async update(data: z.infer<typeof updateSiteSettingSchema>) {
    return db.siteSetting.upsert({
      where: { id: 'default' },
      update: data as Prisma.SiteSettingUpdateInput,
      create: {
        id: 'default',
        ...(data as Prisma.SiteSettingCreateInput),
      },
    });
  }
}
