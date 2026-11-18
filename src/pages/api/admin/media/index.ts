import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { MediaService } from '../../../../services/media.service';
import { mediaQuerySchema } from '../../../../lib/validators/media';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = mediaQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsed.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await MediaService.listMedia(parsed.data);
    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to list media assets');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
