import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { db } from '../../src/lib/db';
import { AnalyticsService } from '../../src/services/analytics.service';
import { processAnalyticsCleanupJob } from '../../src/jobs/worker';
import { Status } from '@prisma/client';

describe('Privacy-First Analytics Engine & Aggregation (Unit Tests)', () => {
  let testProjectId: string;

  beforeAll(async () => {
    // Create a temporary project for testing project clicks
    const project = await db.project.create({
      data: {
        title: 'Analytics Unit Test Project',
        slug: 'analytics-unit-test-' + Date.now(),
        description: 'Test project description for analytics testing',
        summary: 'Testing analytics click tracking',
        demoUrl: 'https://demo.example.com',
        githubUrl: 'https://github.com/saidkhan/test-project',
        featured: false,
        status: Status.PUBLISHED,
      },
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    // Cleanup created data
    await db.pageView.deleteMany({
      where: { path: { startsWith: '/unit-test-analytics' } },
    });
    await db.projectClick.deleteMany({
      where: { projectId: testProjectId },
    });
    await db.project.deleteMany({
      where: { id: testProjectId },
    });
    await db.$disconnect();
  });

  describe('Bot User-Agent Detection & Privacy Hashing', () => {
    it('should correctly classify search engine crawlers and automated bots', () => {
      expect(
        AnalyticsService.isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
      ).toBe(true);
      expect(
        AnalyticsService.isBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')
      ).toBe(true);
      expect(AnalyticsService.isBot('curl/7.81.0')).toBe(true);
      expect(AnalyticsService.isBot('python-requests/2.28.1')).toBe(true);
      expect(AnalyticsService.isBot('PostmanRuntime/7.29.2')).toBe(true);
    });

    it('should permit legitimate human browser traffic', () => {
      const realChromeUa =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(AnalyticsService.isBot(realChromeUa)).toBe(false);

      const realFirefoxUa =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:109.0) Gecko/20100101 Firefox/119.0';
      expect(AnalyticsService.isBot(realFirefoxUa)).toBe(false);

      const realIphoneUa =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
      expect(AnalyticsService.isBot(realIphoneUa)).toBe(false);
    });

    it('should create irreversible privacy-preserving SHA-256 hashes', () => {
      const rawIp = '192.168.1.100';
      const hash1 = AnalyticsService.hashIdentifier(rawIp);
      const hash2 = AnalyticsService.hashIdentifier(rawIp);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toContain(rawIp);
      expect(hash1.length).toBe(64); // SHA-256 hex length
    });
  });

  describe('Page View & Project Click Tracking', () => {
    it('should record legitimate page views and ignore bot page views', async () => {
      const legitimateIp = '10.20.30.40';
      const legitimateUa =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

      const result = await AnalyticsService.recordPageView(
        { path: '/unit-test-analytics/overview', referrer: 'https://news.ycombinator.com' },
        legitimateIp,
        legitimateUa
      );

      expect(result.recorded).toBe(true);
      expect(result.id).toBeDefined();

      // Bot attempt
      const botResult = await AnalyticsService.recordPageView(
        { path: '/unit-test-analytics/overview' },
        '10.20.30.41',
        'Googlebot/2.1'
      );

      expect(botResult.recorded).toBe(false);
      expect(botResult.ignored).toBe(true);
    });

    it('should record project clicks and reject non-existent projects', async () => {
      // Record multiple clicks to ensure this project appears at the top of topProjects
      for (let i = 0; i < 5; i++) {
        const clickRes = await AnalyticsService.recordProjectClick(
          { projectId: testProjectId, type: i % 2 === 0 ? 'DEMO' : 'GITHUB' },
          `10.20.30.${50 + i}`,
          'Mozilla/5.0'
        );
        expect(clickRes.recorded).toBe(true);
        expect(clickRes.id).toBeDefined();
      }

      // Non-existent project
      await expect(
        AnalyticsService.recordProjectClick(
          { projectId: 'non-existent-project-id-999', type: 'GITHUB' },
          '10.20.30.50'
        )
      ).rejects.toThrowError(/not found/i);
    });
  });

  describe('Analytics Stats Aggregation & Views Per Day', () => {
    it('should compute aggregated metrics including top pages, project clicks, and day timelines', async () => {
      const stats = await AnalyticsService.getStats({ range: '30d' });

      expect(stats.totalPageViews).toBeGreaterThanOrEqual(1);
      expect(stats.uniqueVisitors).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(stats.topPages)).toBe(true);
      expect(Array.isArray(stats.topProjects)).toBe(true);
      expect(Array.isArray(stats.viewsPerDay)).toBe(true);
      expect(stats.viewsPerDay.length).toBe(30);

      // Verify topPages contains our test path
      expect(stats.topPages.some((p) => p.path === '/unit-test-analytics/overview')).toBe(true);

      // Verify topProjects contains our test project
      expect(stats.topProjects.some((p) => p.projectId === testProjectId)).toBe(true);
    });
  });

  describe('BullMQ 90-Day Retention Pruning Job', () => {
    it('should delete analytics records older than 90 days and retain recent records', async () => {
      const ancientDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000); // 95 days ago

      // Seed an ancient page view
      const ancientPv = await db.pageView.create({
        data: {
          path: '/unit-test-analytics/ancient-page',
          ipHash: AnalyticsService.hashIdentifier('1.1.1.1'),
          timestamp: ancientDate,
        },
      });

      // Run pruning processor
      const pruneSummary = await processAnalyticsCleanupJob();
      expect(pruneSummary.prunedPageViews).toBeGreaterThanOrEqual(1);

      // Verify ancient record is deleted
      const checkPv = await db.pageView.findUnique({
        where: { id: ancientPv.id },
      });
      expect(checkPv).toBeNull();
    });
  });
});
