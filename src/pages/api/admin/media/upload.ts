import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { MediaService } from '../../../../services/media.service';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'Upload request must be multipart/form-data',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const altText = formData.get('altText')?.toString() || undefined;

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: 'No file provided in form-data under key "file"',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const user = locals.user;
    const media = await MediaService.uploadMedia(
      {
        buffer,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      },
      altText,
      user?.id
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: media,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    if (errInfo.statusCode && errInfo.code) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: errInfo.code, message: errInfo.message },
        }),
        { status: errInfo.statusCode, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.error({ err }, 'Failed to upload media asset');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message || 'Media upload failed' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
