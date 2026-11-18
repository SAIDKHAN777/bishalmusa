import { describe, it, expect, afterAll } from 'vitest';
import { db } from '../../src/lib/db';
import { MediaService } from '../../src/services/media.service';
import {
  validateMediaFile,
  getOptimizedDeliveryUrl,
  MAX_IMAGE_SIZE_BYTES,
  MAX_DOCUMENT_SIZE_BYTES,
} from '../../src/lib/cloudinary';

describe('Media Asset Management & Cloudinary Delivery (Unit Tests)', () => {
  afterAll(async () => {
    // Cleanup media and resume downloads created during test
    await db.media.deleteMany({
      where: { publicId: { contains: 'unit-test' } },
    });
    await db.resumeDownload.deleteMany({
      where: { referrer: 'unit-test-referrer' },
    });
    await db.$disconnect();
  });

  describe('Media File Validation & Size Limits', () => {
    it('should approve valid image MIME types within 10MB limit', () => {
      const resultJpeg = validateMediaFile('image/jpeg', 2 * 1024 * 1024);
      expect(resultJpeg.resourceType).toBe('image');

      const resultPng = validateMediaFile('image/png', 5 * 1024 * 1024);
      expect(resultPng.resourceType).toBe('image');

      const resultWebp = validateMediaFile('image/webp', 1 * 1024 * 1024);
      expect(resultWebp.resourceType).toBe('image');
    });

    it('should approve PDF resume document within 15MB limit', () => {
      const resultPdf = validateMediaFile('application/pdf', 8 * 1024 * 1024);
      expect(resultPdf.resourceType).toBe('raw');
    });

    it('should reject unsupported and dangerous file types', () => {
      expect(() => validateMediaFile('application/x-msdownload', 5000)).toThrowError(
        /Unsupported file format/
      );
      expect(() => validateMediaFile('text/html', 5000)).toThrowError(/Unsupported file format/);
      expect(() => validateMediaFile('application/javascript', 5000)).toThrowError(
        /Unsupported file format/
      );
    });

    it('should reject oversized image files exceeding 10MB', () => {
      expect(() => validateMediaFile('image/png', MAX_IMAGE_SIZE_BYTES + 1024)).toThrowError(
        /exceeds maximum allowed limit/
      );
    });

    it('should reject oversized PDF files exceeding 15MB', () => {
      expect(() => validateMediaFile('application/pdf', MAX_DOCUMENT_SIZE_BYTES + 1024)).toThrowError(
        /exceeds maximum allowed limit/
      );
    });
  });

  describe('Cloudinary URL Optimization Helper', () => {
    it('should construct delivery URLs with auto-format, auto-quality and responsive bounds', () => {
      const publicId = 'portfolio/avatars/unit-test-avatar';
      const url = getOptimizedDeliveryUrl(publicId, 'image', {
        width: 600,
        height: 400,
      });

      expect(url).toContain('f_auto');
      expect(url).toContain('q_auto');
      expect(url).toContain('w_600');
      expect(url).toContain('h_400');
      expect(url).toContain(publicId);
    });

    it('should construct secure raw URL for PDF files without image transformations', () => {
      const rawPublicId = 'portfolio/resumes/unit-test-resume.pdf';
      const url = getOptimizedDeliveryUrl(rawPublicId, 'raw');

      expect(url).toContain('raw/upload');
      expect(url).toContain(rawPublicId);
    });
  });

  describe('MediaService Upload, Read, Update, Delete Lifecycle', () => {
    let createdMediaId: string;

    it('should upload image, store in database, and generate optimized URL', async () => {
      const dummyImageBuffer = Buffer.from('fake-png-binary-stream-data-content');
      const upload = await MediaService.uploadMedia(
        {
          buffer: dummyImageBuffer,
          filename: 'unit-test-hero.png',
          mimeType: 'image/png',
          size: dummyImageBuffer.length,
        },
        'Hero banner for unit test'
      );

      expect(upload.id).toBeDefined();
      expect(upload.resourceType).toBe('image');
      expect(upload.altText).toBe('Hero banner for unit test');
      expect(upload.optimizedUrl).toBeDefined();
      expect(upload.optimizedUrl).toContain('f_auto');

      createdMediaId = upload.id;
    });

    it('should upload PDF document as raw asset', async () => {
      const dummyPdfBuffer = Buffer.from('%PDF-1.4 simulated pdf document data');
      const upload = await MediaService.uploadMedia(
        {
          buffer: dummyPdfBuffer,
          filename: 'unit-test-resume.pdf',
          mimeType: 'application/pdf',
          size: dummyPdfBuffer.length,
        },
        'Said Khan Curriculum Vitae'
      );

      expect(upload.id).toBeDefined();
      expect(upload.resourceType).toBe('raw');
      expect(upload.format).toBe('pdf');
      expect(upload.optimizedUrl).toContain('raw/upload');
    });

    it('should list media items with pagination and search', async () => {
      const list = await MediaService.listMedia({
        page: 1,
        limit: 10,
        search: 'unit-test',
      });

      expect(list.items.length).toBeGreaterThanOrEqual(1);
      expect(list.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('should update media alt text metadata', async () => {
      const updated = await MediaService.updateMedia(createdMediaId, {
        altText: 'Updated accessible image description',
      });

      expect(updated.altText).toBe('Updated accessible image description');
    });

    it('should delete media from Cloudinary and database', async () => {
      const deleteResult = await MediaService.deleteMedia(createdMediaId);
      expect(deleteResult.message).toContain('deleted successfully');

      // Verify record is gone from DB
      await expect(MediaService.getMediaById(createdMediaId)).rejects.toThrowError(
        /not found/i
      );
    });
  });

  describe('Resume Download Tracking Service', () => {
    it('should record download event with hashed IP and return valid URL', async () => {
      const clientIp = '172.16.0.50';
      const result = await MediaService.trackResumeDownload(clientIp, 'unit-test-referrer');

      expect(result.resumeUrl).toBeDefined();
      expect(typeof result.resumeUrl).toBe('string');

      // Verify recorded in DB
      const downloadRecord = await db.resumeDownload.findFirst({
        where: { referrer: 'unit-test-referrer' },
      });
      expect(downloadRecord).not.toBeNull();
      expect(downloadRecord?.ipHash).toBeDefined();
    });
  });
});
