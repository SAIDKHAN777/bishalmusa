import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { loginSchema } from '../../../../lib/validators/auth';
import { AuthService } from '../../../../services/auth.service';
import { PortfolioService } from '../../../../services/portfolio.service';
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from '../../../../lib/auth';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress, cookies }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input parameters',
            details: parsed.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email, password } = parsed.data;
    const ip =
      clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || undefined;

    await PortfolioService.ensureInitialized();
    const result = email
      ? await AuthService.login(email, password, ip, userAgent)
      : await AuthService.loginByPassword(password, ip, userAgent);

    cookies.set(SESSION_COOKIE_NAME, result.token, getSessionCookieOptions());

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: result.user,
          expiresAt: result.expiresAt.toISOString(),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    const rawMessage = errInfo.message || 'Login failed';
    const isRateLimit = rawMessage.includes('TOO_MANY_REQUESTS');
    const isInvalidCreds = rawMessage.includes('INVALID_CREDENTIALS');

    const statusCode = isRateLimit ? 429 : isInvalidCreds ? 401 : 500;
    const code = isRateLimit
      ? 'TOO_MANY_REQUESTS'
      : isInvalidCreds
      ? 'INVALID_CREDENTIALS'
      : 'INTERNAL_SERVER_ERROR';

    logger.warn({ code, statusCode }, 'Login request rejected');

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code,
          message: rawMessage,
        },
      }),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
