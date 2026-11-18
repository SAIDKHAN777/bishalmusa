import { defineMiddleware } from 'astro:middleware';
import type { APIContext, MiddlewareNext } from 'astro';
import { AuthService } from '../services/auth.service';
import { SecurityService } from '../services/security.service';
import { SESSION_COOKIE_NAME } from '../lib/auth';
import { logger } from '../lib/logger';
import { env } from '../lib/env';

function isAllowedOrigin(originUrl: string, hostHeader: string | null): boolean {
  try {
    const origin = new URL(originUrl);
    const norm = (str: string) => str.replace(/^127\.0\.0\.1/, 'localhost');

    const originHost = norm(origin.host);
    const originHostname = norm(origin.hostname);

    if (hostHeader) {
      const normHostHeader = norm(hostHeader);
      const normHostHeaderName = norm(hostHeader.split(':')[0]);

      if (originHost === normHostHeader || originHostname === normHostHeaderName) {
        return true;
      }
    }

    try {
      const site = new URL(env.SITE_URL);
      if (originHostname === norm(site.hostname)) {
        return true;
      }
    } catch {
      // ignore
    }

    return false;
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, cookies } = context;
  const pathname = url.pathname;
  const method = request.method;

  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    context.clientAddress ||
    '127.0.0.1';

  // 1. Handle CORS Preflight (OPTIONS)
  if (method === 'OPTIONS') {
    const origin = request.headers.get('origin');
    const headers = new Headers();
    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
    return new Response(null, { status: 204, headers });
  }

  // 2. Global Rate Limiting backed by Redis
  const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.includes('localhost');
  const effectiveLimit = isLoopback ? 3000 : SecurityService.GLOBAL_RATE_LIMIT_MAX;

  const rateLimitResult = await SecurityService.checkGlobalRateLimit(clientIp, effectiveLimit);
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down and try again later.',
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.reset),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.reset),
        },
      }
    );
  }

  // 3. Request Payload Size Guard (Prevent DoS via oversized JSON bodies)
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      const contentLength = request.headers.get('content-length');
      if (!SecurityService.validatePayloadSize(contentLength)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Request payload exceeds the maximum allowed limit of 1MB',
            },
          }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // 4. CSRF Protection for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin) {
      const isAllowed = isAllowedOrigin(origin, host);
      if (!isAllowed) {
        logger.warn({ origin, host, pathname }, 'CSRF validation failed');
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Cross-origin request blocked (CSRF protection)',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // 5. Protect Admin API routes (/api/admin/*)
  if (pathname.startsWith('/api/admin')) {
    // Exempt login endpoint
    if (pathname === '/api/admin/auth/login') {
      return executeWithCentralErrorHandler(context, next);
    }

    const token = cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication session required to access this endpoint',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await AuthService.validateSession(token);
    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session has expired or is invalid. Please log in again.',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    context.locals.user = user;
    return executeWithCentralErrorHandler(context, next);
  }

  // 6. Protect Admin UI routes (/admin/*)
  if (pathname.startsWith('/admin')) {
    // Exempt login UI page
    if (pathname === '/admin/login') {
      return executeWithCentralErrorHandler(context, next);
    }

    const token = cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return context.redirect('/admin/login', 302);
    }

    const user = await AuthService.validateSession(token);
    if (!user) {
      return context.redirect('/admin/login', 302);
    }

    context.locals.user = user;
    return executeWithCentralErrorHandler(context, next);
  }

  // 7. Public routes execution
  return executeWithCentralErrorHandler(context, next);
});

/**
 * Execute route with central error boundary and comprehensive security headers injection
 */
async function executeWithCentralErrorHandler(
  context: APIContext,
  next: MiddlewareNext
): Promise<Response> {
  const { request, url } = context;
  const pathname = url.pathname;
  const method = request.method;

  try {
    const response: Response = await next();

    // Security Headers
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://res.cloudinary.com blob:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
    );
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );

    // Dynamic CORS headers for responses
    const origin = request.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return response;
  } catch (err: unknown) {
    return SecurityService.formatSafeErrorResponse(err, pathname, method);
  }
}
