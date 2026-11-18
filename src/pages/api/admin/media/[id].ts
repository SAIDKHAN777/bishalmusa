import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { MediaService } from '../../../../services/media.service';
import { mediaUpdateSchema } from '../../../../lib/validators/media';

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_ID', message: 'Media ID is required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const width = url.searchParams.get('width') ? Number(url.searchParams.get('width')) : undefined;
    const height = url.searchParams.get('height') ? Number(url.searchParams.get('height')) : undefined;

    const media = await MediaService.getMediaById(id, { width, height });
    return new Response(
      JSON.stringify({ success: true, data: media }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    const status = errInfo.statusCode || (errInfo.code === 'NOT_FOUND' ? 404 : 500);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: errInfo.code || 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_ID', message: 'Media ID is required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = mediaUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload',
            details: parsed.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await MediaService.updateMedia(id, parsed.data);
    return new Response(
      JSON.stringify({ success: true, data: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    const status = errInfo.statusCode || (errInfo.code === 'NOT_FOUND' ? 404 : 500);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: errInfo.code || 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_ID', message: 'Media ID is required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await MediaService.deleteMedia(id);
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    const status = errInfo.statusCode || (errInfo.code === 'NOT_FOUND' ? 404 : 500);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: errInfo.code || 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
