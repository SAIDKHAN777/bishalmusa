import type { APIRoute } from 'astro';
import { logger } from '../../lib/logger';
import { checkDatabaseHealth } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    logger.debug('Health check requested');
    const dbHealth = await checkDatabaseHealth();

    if (!dbHealth.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'Database health check failed',
            details: dbHealth.error,
          },
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: 'ok',
          database: {
            status: 'connected',
            latencyMs: dbHealth.latencyMs,
          },
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    logger.error({ err: error }, 'Health check failure');
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Health check failed',
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
