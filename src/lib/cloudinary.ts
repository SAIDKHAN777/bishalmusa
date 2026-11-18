import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from './env';
import { logger } from './logger';
import { AppError } from './error-utils';

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'];

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export interface UploadOptions {
  folder?: string;
  publicId?: string;
  tags?: string[];
}

export interface OptimizedUrlOptions {
  width?: number;
  height?: number;
  crop?: string;
  quality?: string | number;
  format?: string;
}

/**
 * Validates file MIME type and size
 */
export function validateMediaFile(mimeType: string, byteSize: number) {
  const isImage = ALLOWED_IMAGE_MIME_TYPES.includes(mimeType);
  const isDocument = ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType);

  if (!isImage && !isDocument) {
    throw new AppError(
      `Unsupported file format: ${mimeType}. Allowed formats are JPEG, PNG, WEBP, GIF, SVG, and PDF.`,
      'UNSUPPORTED_MEDIA_TYPE',
      400
    );
  }

  if (isImage && byteSize > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError(
      `Image file size exceeds maximum allowed limit of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`,
      'FILE_TOO_LARGE',
      400
    );
  }

  if (isDocument && byteSize > MAX_DOCUMENT_SIZE_BYTES) {
    throw new AppError(
      `Document file size exceeds maximum allowed limit of ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB.`,
      'FILE_TOO_LARGE',
      400
    );
  }

  return {
    resourceType: isImage ? 'image' : 'raw',
  };
}

/**
 * Generate optimized delivery URL with auto-format, auto-quality and responsive dimensions
 */
export function getOptimizedDeliveryUrl(
  publicId: string,
  resourceType: string = 'image',
  options?: OptimizedUrlOptions
): string {
  if (resourceType === 'raw') {
    // PDF / Raw assets delivery
    return cloudinary.url(publicId, {
      resource_type: 'raw',
      secure: true,
    });
  }

  return cloudinary.url(publicId, {
    resource_type: 'image',
    fetch_format: options?.format || 'auto',
    quality: options?.quality || 'auto',
    width: options?.width,
    height: options?.height,
    crop: options?.crop || (options?.width || options?.height ? 'limit' : undefined),
    secure: true,
  });
}

/**
 * Upload buffer to Cloudinary
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  options?: UploadOptions
): Promise<{
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  resourceType: string;
  byteSize: number;
  width?: number;
  height?: number;
}> {
  const { resourceType } = validateMediaFile(mimeType, buffer.length);
  const isMock =
    env.NODE_ENV === 'test' ||
    env.CLOUDINARY_API_SECRET === 'sample_cloudinary_api_secret' ||
    env.CLOUDINARY_CLOUD_NAME === 'demo_cloud';

  const folder = options?.folder || 'portfolio';
  const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const customPublicId = options?.publicId || `${folder}/${Date.now()}_${cleanName}`;
  const extension = filename.split('.').pop()?.toLowerCase() || (resourceType === 'image' ? 'jpg' : 'pdf');

  if (isMock) {
    logger.info(
      { filename, mimeType, size: buffer.length, customPublicId },
      '[MOCK/DEV] Cloudinary upload simulated successfully'
    );
    return {
      publicId: customPublicId,
      url: `http://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/v1/${customPublicId}.${extension}`,
      secureUrl: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/v1/${customPublicId}.${extension}`,
      format: extension,
      resourceType,
      byteSize: buffer.length,
      width: resourceType === 'image' ? 1200 : undefined,
      height: resourceType === 'image' ? 800 : undefined,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType as 'image' | 'raw',
        folder,
        public_id: options?.publicId,
        tags: options?.tags,
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          logger.error({ error, filename }, 'Cloudinary upload error');
          return reject(error || new Error('Upload to Cloudinary failed'));
        }

        resolve({
          publicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          format: result.format || extension,
          resourceType: result.resource_type,
          byteSize: result.bytes,
          width: result.width,
          height: result.height,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete asset from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: string = 'image'
): Promise<boolean> {
  const isMock =
    env.NODE_ENV === 'test' ||
    env.CLOUDINARY_API_SECRET === 'sample_cloudinary_api_secret' ||
    env.CLOUDINARY_CLOUD_NAME === 'demo_cloud';

  if (isMock) {
    logger.info({ publicId, resourceType }, '[MOCK/DEV] Cloudinary asset deletion simulated');
    return true;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType as 'image' | 'raw',
    });
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    logger.error({ error, publicId }, 'Failed to delete asset from Cloudinary');
    return false;
  }
}
