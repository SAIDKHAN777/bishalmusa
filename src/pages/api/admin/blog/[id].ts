import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { BlogService } from '../../../../services/blog.service';
import { updateBlogPostSchema } from '../../../../lib/validators/blog';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Blog post ID required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const post = await BlogService.getPostById(id);
    if (!post) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Blog post not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: post }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to fetch blog post');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Blog post ID required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.issues },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await BlogService.updatePost(id, parsed.data);
    return new Response(
      JSON.stringify({ success: true, data: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to update blog post');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Blog post ID required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await BlogService.deletePost(id);
    return new Response(
      JSON.stringify({ success: true, data: { message: 'Blog post deleted successfully' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to delete blog post');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
