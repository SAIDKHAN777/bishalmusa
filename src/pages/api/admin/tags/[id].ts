import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { BlogService } from '../../../../services/blog.service';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Tag ID required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await BlogService.deleteTag(id);
    return new Response(
      JSON.stringify({ success: true, data: { message: 'Tag deleted successfully' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to delete tag');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
