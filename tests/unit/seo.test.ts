import { describe, it, expect } from 'vitest';
import {
  escapeXml,
  generatePersonSchema,
  generateWebSiteSchema,
  generateArticleSchema,
  generateSitemapXml,
  generateRobotsTxt,
} from '../../src/lib/seo';

describe('SEO Automation, Structured Data & Feed Generation (Unit Tests)', () => {
  describe('XML Character Escaping', () => {
    it('should correctly escape special XML characters', () => {
      const raw = 'Building Distributed Systems & Microservices <Node.js> "Rocks" \'Fast\'';
      const escaped = escapeXml(raw);

      expect(escaped).toBe(
        'Building Distributed Systems &amp; Microservices &lt;Node.js&gt; &quot;Rocks&quot; &apos;Fast&apos;'
      );
    });

    it('should return empty string for null or empty inputs', () => {
      expect(escapeXml('')).toBe('');
    });
  });

  describe('Schema.org JSON-LD Generators', () => {
    it('should generate valid Person schema with essential author attributes', () => {
      const schema = generatePersonSchema({
        name: 'Said Khan',
        url: 'https://saidkhan.dev',
        jobTitle: 'Senior Software Engineer',
        email: 'contact@saidkhan.dev',
      });

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('Person');
      expect(schema.name).toBe('Said Khan');
      expect(schema.url).toBe('https://saidkhan.dev');
      expect(schema.jobTitle).toBe('Senior Software Engineer');
      expect(Array.isArray(schema.sameAs)).toBe(true);
    });

    it('should generate valid WebSite schema', () => {
      const schema = generateWebSiteSchema({
        name: 'Said Khan Engineering Portfolio',
        url: 'https://saidkhan.dev',
      });

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('WebSite');
      expect(schema.name).toBe('Said Khan Engineering Portfolio');
      expect(schema.url).toBe('https://saidkhan.dev');
    });

    it('should generate valid BlogPosting / Article schema with dates, keywords, and author', () => {
      const schema = generateArticleSchema({
        title: 'High-Performance Node.js with Redis and BullMQ',
        description: 'Deep dive into architecting resilient background workers.',
        url: 'https://saidkhan.dev/blog/nodejs-redis-bullmq',
        publishedAt: '2026-03-15T10:00:00.000Z',
        authorName: 'Said Khan',
        tags: ['Node.js', 'Redis', 'BullMQ'],
      });

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('BlogPosting');
      expect(schema.headline).toBe('High-Performance Node.js with Redis and BullMQ');
      expect(schema.datePublished).toBe('2026-03-15T10:00:00.000Z');
      expect(schema.author.name).toBe('Said Khan');
      expect(schema.keywords).toContain('BullMQ');
    });
  });

  describe('Sitemap XML Generation', () => {
    it('should construct valid XML sitemap including static routes, projects, and posts', () => {
      const siteUrl = 'https://saidkhan.dev';
      const staticPages = [
        { path: '/', changefreq: 'daily', priority: 1.0 },
        { path: '/projects', changefreq: 'weekly', priority: 0.9 },
        { path: '/blog', changefreq: 'weekly', priority: 0.9 },
      ];

      const projects = [
        { slug: 'enterprise-madrasa-platform', updatedAt: new Date('2026-02-10') },
      ];

      const posts = [
        { slug: 'building-resilient-microservices', updatedAt: new Date('2026-02-20') },
      ];

      const sitemap = generateSitemapXml(siteUrl, staticPages, projects, posts);

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemap).toContain('<loc>https://saidkhan.dev/</loc>');
      expect(sitemap).toContain('<loc>https://saidkhan.dev/projects/enterprise-madrasa-platform</loc>');
      expect(sitemap).toContain('<loc>https://saidkhan.dev/blog/building-resilient-microservices</loc>');
      expect(sitemap).toContain('<priority>1.0</priority>');
      expect(sitemap).toContain('<priority>0.8</priority>');
      expect(sitemap).toContain('<priority>0.9</priority>');
    });
  });

  describe('Robots.txt Directives', () => {
    it('should permit search indexing and protect admin/internal endpoints', () => {
      const robots = generateRobotsTxt('https://saidkhan.dev', false);

      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Disallow: /admin/');
      expect(robots).toContain('Disallow: /api/admin/');
      expect(robots).toContain('Allow: /api/resume/download');
      expect(robots).toContain('Sitemap: https://saidkhan.dev/sitemap.xml');
    });

    it('should block all indexing when maintenance mode is active', () => {
      const robots = generateRobotsTxt('https://saidkhan.dev', true);

      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Disallow: /');
      expect(robots).not.toContain('Allow: /');
    });
  });
});
