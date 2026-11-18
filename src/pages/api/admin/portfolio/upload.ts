import type { APIRoute } from 'astro';
import { PortfolioService } from '../../../../services/portfolio.service';
import { logger } from '../../../../lib/logger';
import { getErrorInfo } from '../../../../lib/error-utils';

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
    const kindRaw = formData.get('kind')?.toString();
    const kind: 'image' | 'pdf' = kindRaw === 'pdf' ? 'pdf' : 'image';

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'FILE_REQUIRED', message: 'No file provided under key "file".' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const uploaded = await PortfolioService.saveUploadedFile(file, kind, locals.user?.id);

    return new Response(JSON.stringify({ success: true, data: uploaded }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const info = getErrorInfo(err, 'Upload failed');
    logger.error({ err }, 'Portfolio file upload failed');
    const status = info.statusCode || 500;
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: info.code || 'UPLOAD_ERROR', message: info.message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
