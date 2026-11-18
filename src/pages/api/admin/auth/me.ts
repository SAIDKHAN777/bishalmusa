import type { APIRoute } from 'astro';
import { AuthService } from '../../../../services/auth.service';
import { SESSION_COOKIE_NAME } from '../../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, locals }) => {
  // Can be populated by middleware in locals.user or read directly from cookie
  const user = locals.user;
  if (user) {
    return new Response(
      JSON.stringify({
        success: true,
        data: { user },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication session required',
        },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const sessionUser = await AuthService.validateSession(token);
  if (!sessionUser) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired session',
        },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: { user: sessionUser },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
