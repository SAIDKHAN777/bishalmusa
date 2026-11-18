import type { APIRoute } from 'astro';
import { AuthService } from '../../../../services/auth.service';
import { SESSION_COOKIE_NAME } from '../../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await AuthService.logout(token);
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        message: 'Successfully logged out',
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`,
      },
    }
  );
};
