import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { BlogService } from '../../../../services/blog.service';
import { createBlogPostSchema, blogQuerySchema } from '../../../../lib/validators/blog';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = blogQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.issues },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await BlogService.listPosts({ ...parsed.data, isAdmin: true });
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to fetch blog posts');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.issues },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const post = await BlogService.createPost(parsed.data);
    return new Response(
      JSON.stringify({ success: true, data: post }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to create blog post');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
