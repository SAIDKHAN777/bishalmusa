import crypto from 'crypto';
import { db } from '../lib/db';
import { AppError } from '../lib/error-utils';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import type {
  PageViewInput,
  ProjectClickInput,
  AnalyticsStatsQueryInput,
} from '../lib/validators/analytics';

const BOT_USER_AGENTS_REGEX =
  /bot|spider|crawl|slurp|facebookexternalhit|bingbot|googlebot|yandex|duckduckbot|baiduspider|twitterbot|slackbot|curl|wget|python|postman|headless/i;

export class AnalyticsService {
  /**
   * Check if User-Agent string belongs to a web crawler or bot
   */
  static isBot(userAgent?: string | null): boolean {
    if (!userAgent) return false;
    return BOT_USER_AGENTS_REGEX.test(userAgent);
  }

  /**
   * Privacy-preserving SHA-256 hash using the secret ANALYTICS_SALT
   */
  static hashIdentifier(value: string): string {
    return crypto
      .createHash('sha256')
      .update((value || '127.0.0.1') + env.ANALYTICS_SALT)
      .digest('hex');
  }

  /**
   * Record privacy-friendly page view (bots filtered, IP/UA hashed, no PII)
   */
  static async recordPageView(input: PageViewInput, clientIp: string, userAgent?: string | null) {
    if (this.isBot(userAgent)) {
      logger.info({ userAgent, path: input.path }, 'Ignored bot pageview');
      return { recorded: false, ignored: true, reason: 'BOT_DETECTED' };
    }

    const ipHash = this.hashIdentifier(clientIp);
    const userAgentHash = userAgent ? this.hashIdentifier(userAgent) : null;

    const pageView = await db.pageView.create({
      data: {
        path: input.path,
        referrer: input.referrer || null,
        ipHash,
        userAgentHash,
      },
    });

    return { recorded: true, id: pageView.id };
  }

  /**
   * Record project link click (Demo or GitHub)
   */
  static async recordProjectClick(
    input: ProjectClickInput,
    clientIp: string,
    userAgent?: string | null
  ) {
    if (this.isBot(userAgent)) {
      logger.info({ userAgent, projectId: input.projectId }, 'Ignored bot project click');
      return { recorded: false, ignored: true, reason: 'BOT_DETECTED' };
    }

    // Verify project exists
    const project = await db.project.findUnique({
      where: { id: input.projectId },
    });

    if (!project) {
      throw new AppError('Project not found', 'NOT_FOUND', 404);
    }

    const ipHash = this.hashIdentifier(clientIp);

    const click = await db.projectClick.create({
      data: {
        projectId: input.projectId,
        type: input.type,
        ipHash,
      },
    });

    return { recorded: true, id: click.id };
  }

  /**
   * Admin: Get aggregated analytics statistics
   */
  static async getStats(query: AnalyticsStatsQueryInput) {
    const range = query.range || '30d';

    let startDate: Date;
    let daysCount = 30;

    switch (range) {
      case '7d':
        daysCount = 7;
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        daysCount = 90;
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        daysCount = 30; // for chart rendering window
        startDate = new Date(0);
        break;
      case '30d':
      default:
        daysCount = 30;
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const whereTime = range === 'all' ? {} : { timestamp: { gte: startDate } };

    // Total counts
    const [totalPageViews, totalResumeDownloads, uniqueIpRecords] = await Promise.all([
      db.pageView.count({ where: whereTime }),
      db.resumeDownload.count({ where: whereTime }),
      db.pageView.findMany({
        where: whereTime,
        select: { ipHash: true },
        distinct: ['ipHash'],
      }),
    ]);

    const uniqueVisitors = uniqueIpRecords.length;

    // Top pages grouped by views
    const groupedPages = await db.pageView.groupBy({
      by: ['path'],
      where: whereTime,
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    });

    const topPages = groupedPages.map((p) => ({
      path: p.path,
      views: p._count.path,
    }));

    // Top projects and clicks
    const projectClicks = await db.projectClick.findMany({
      where: whereTime,
      include: {
        project: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    const projectMap = new Map<
      string,
      {
        projectId: string;
        title: string;
        slug: string;
        demoClicks: number;
        githubClicks: number;
        totalClicks: number;
      }
    >();

    for (const c of projectClicks) {
      let entry = projectMap.get(c.projectId);
      if (!entry) {
        entry = {
          projectId: c.projectId,
          title: c.project?.title || 'Unknown Project',
          slug: c.project?.slug || '',
          demoClicks: 0,
          githubClicks: 0,
          totalClicks: 0,
        };
        projectMap.set(c.projectId, entry);
      }

      if (c.type === 'DEMO') entry.demoClicks++;
      if (c.type === 'GITHUB') entry.githubClicks++;
      entry.totalClicks++;
    }

    const topProjects = Array.from(projectMap.values())
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .slice(0, 10);

    // Views per day timeline
    const allViews = await db.pageView.findMany({
      where: whereTime,
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const dayMap = new Map<string, number>();

    // Pre-populate days
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      dayMap.set(dateStr, 0);
    }

    for (const pv of allViews) {
      const dateStr = pv.timestamp.toISOString().split('T')[0];
      if (dayMap.has(dateStr)) {
        dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
      } else {
        dayMap.set(dateStr, 1);
      }
    }

    const viewsPerDay = Array.from(dayMap.entries())
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      range,
      totalPageViews,
      totalResumeDownloads,
      uniqueVisitors,
      topPages,
      topProjects,
      viewsPerDay,
    };
  }
}
