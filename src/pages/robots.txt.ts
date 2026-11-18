import type { APIRoute } from 'astro';
import { db } from '../lib/db';
import { env } from '../lib/env';
import { generateRobotsTxt } from '../lib/seo';
import { logger } from '../lib/logger';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const siteSetting = await db.siteSetting.findFirst();
    const disallowAll = siteSetting?.maintenanceMode || false;

    const robotsTxt = generateRobotsTxt(env.SITE_URL, disallowAll);

    return new Response(robotsTxt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to generate robots.txt');
    return new Response('User-agent: *\nAllow: /\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};
