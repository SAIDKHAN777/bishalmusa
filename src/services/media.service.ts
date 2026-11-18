import crypto from 'crypto';
import { db } from '../lib/db';
import { type Prisma } from '@prisma/client';
import { AppError } from '../lib/error-utils';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedDeliveryUrl,
  type OptimizedUrlOptions,
} from '../lib/cloudinary';
import type { MediaQueryInput, MediaUpdateInput } from '../lib/validators/media';

export interface FilePayload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export class MediaService {
  /**
   * Admin: Upload file (Image or PDF) to Cloudinary and record in database
   */
  static async uploadMedia(file: FilePayload, altText?: string, userId?: string) {
    const uploadResult = await uploadToCloudinary(file.buffer, file.filename, file.mimeType);

    const media = await db.media.create({
      data: {
        publicId: uploadResult.publicId,
        url: uploadResult.url,
        secureUrl: uploadResult.secureUrl,
        format: uploadResult.format,
        resourceType: uploadResult.resourceType,
        byteSize: uploadResult.byteSize,
        width: uploadResult.width,
        height: uploadResult.height,
        altText: altText || null,
        uploadedById: userId || null,
      },
    });

    logger.info({ mediaId: media.id, publicId: media.publicId }, 'Media uploaded and saved to DB');

    return {
      ...media,
      optimizedUrl: getOptimizedDeliveryUrl(media.publicId, media.resourceType),
    };
  }

  /**
   * Admin: List media assets with pagination and search
   */
  static async listMedia(query: MediaQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MediaWhereInput = {
      deletedAt: null,
    };

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.search) {
      where.OR = [
        { publicId: { contains: query.search, mode: 'insensitive' } },
        { altText: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      db.media.count({ where }),
      db.media.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const itemsWithOptimizedUrls = items.map((item) => ({
      ...item,
      optimizedUrl: getOptimizedDeliveryUrl(item.publicId, item.resourceType),
    }));

    return {
      items: itemsWithOptimizedUrls,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Get a single media asset by ID
   */
  static async getMediaById(id: string, options?: OptimizedUrlOptions) {
    const media = await db.media.findFirst({
      where: { id, deletedAt: null },
    });

    if (!media) {
      throw new AppError('Media asset not found', 'NOT_FOUND', 404);
    }

    return {
      ...media,
      optimizedUrl: getOptimizedDeliveryUrl(media.publicId, media.resourceType, options),
    };
  }

  /**
   * Admin: Update media asset metadata (e.g. alt text)
   */
  static async updateMedia(id: string, input: MediaUpdateInput) {
    await this.getMediaById(id);

    const updated = await db.media.update({
      where: { id },
      data: {
        altText: input.altText,
      },
    });

    return {
      ...updated,
      optimizedUrl: getOptimizedDeliveryUrl(updated.publicId, updated.resourceType),
    };
  }

  /**
   * Admin: Delete media asset from Cloudinary and database
   */
  static async deleteMedia(id: string) {
    const media = await this.getMediaById(id);

    // Delete from Cloudinary
    await deleteFromCloudinary(media.publicId, media.resourceType);

    // Delete from Database
    await db.media.delete({
      where: { id },
    });

    logger.info({ id, publicId: media.publicId }, 'Media deleted from storage and DB');

    return {
      message: 'Media asset deleted successfully from storage and database',
    };
  }

  /**
   * Public: Track Resume Download and get resume delivery URL
   */
  static async trackResumeDownload(clientIp: string, referrer?: string) {
    const ipHash = crypto
      .createHash('sha256')
      .update((clientIp || '127.0.0.1') + env.ANALYTICS_SALT)
      .digest('hex');

    // Record resume download analytics
    await db.resumeDownload.create({
      data: {
        ipHash,
        referrer: referrer || null,
      },
    });

    // Retrieve configured resume URL from SiteSetting
    const setting = await db.siteSetting.findFirst();
    const resumeUrl = setting?.resumeUrl || 'https://res.cloudinary.com/saidkhan-dev/raw/upload/v1/Said_Khan_Resume.pdf';

    logger.info({ ipHash, referrer }, 'Resume download tracked');

    return {
      resumeUrl,
    };
  }
}
