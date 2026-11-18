import { describe, it, expect, afterAll } from 'vitest';
import { db } from '../../src/lib/db';
import { BlogService } from '../../src/services/blog.service';
import { renderMarkdown, calculateReadingTime, generateSlug } from '../../src/lib/markdown';
import { Status } from '@prisma/client';

describe('Blog Engine & Markdown Sanitization (Unit Tests)', () => {
  afterAll(async () => {
    await db.blogPost.deleteMany({ where: { slug: { startsWith: 'unit-blog-' } } });
    await db.tag.deleteMany({ where: { slug: { startsWith: 'unit-tag-' } } });
    await db.$disconnect();
  });

  describe('Markdown Parser & XSS Sanitization', () => {
    it('should correctly render valid Markdown into safe HTML', async () => {
      const markdown = '# Main Heading\n\nThis is a **bold** paragraph with [External Link](https://google.com).';
      const html = await renderMarkdown(markdown);

      expect(html).toContain('<h1>Main Heading</h1>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('should sanitize and neutralize malicious XSS vectors', async () => {
      const maliciousMarkdown = `
# Safe Title
<script>alert("XSS Attack!");</script>
<img src="invalid" onerror="alert(document.cookie)" />
<a href="javascript:stealData()">Malicious Link</a>
Safe text continues.
      `;

      const html = await renderMarkdown(maliciousMarkdown);

      // Verify dangerous tags and attributes are removed
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert(');
      expect(html).not.toContain('onerror=');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('Safe Title');
      expect(html).toContain('Safe text continues.');
    });

    it('should accurately calculate reading time based on word count', () => {
      const shortText = 'One two three four five.';
      expect(calculateReadingTime(shortText)).toBe(1);

      // 450 words should be ~3 minutes (450 / 200 = 2.25 => 3)
      const longText = Array(450).fill('word').join(' ');
      expect(calculateReadingTime(longText)).toBe(3);
    });

    it('should generate valid URL slugs and handle collisions', () => {
      expect(generateSlug('Building Distributed Systems with Node.js & Redis!')).toBe(
        'building-distributed-systems-with-nodejs-redis'
      );
      expect(generateSlug('  Special Characters & Spaces --- ')).toBe('special-characters-spaces');
    });
  });

  describe('BlogService CRUD & Draft/Publish Flow', () => {
    it('should create post, auto-generate slug, link tags, and separate drafts from public', async () => {
      // 1. Create a Draft post
      const draftPost = await BlogService.createPost({
        title: 'Unit Blog Draft Post',
        content: '# Draft Content\nThis is a draft article.',
        status: Status.DRAFT,
        tags: ['unit-tag-devops', 'unit-tag-testing'],
      });

      expect(draftPost.id).toBeDefined();
      expect(draftPost.slug).toContain('unit-blog-draft-post');
      expect(draftPost.readingTimeMinutes).toBe(1);
      expect(draftPost.tags).toHaveLength(2);

      // 2. Create a Published post
      const pubPost = await BlogService.createPost({
        title: 'Unit Blog Published Post',
        content: '# Published Content\nThis is a live article with enough text to be real.',
        status: Status.PUBLISHED,
        tags: ['unit-tag-devops'],
      });

      expect(pubPost.status).toBe(Status.PUBLISHED);
      expect(pubPost.publishedAt).toBeDefined();

      // 3. Public list should ONLY contain published post
      const publicList = await BlogService.listPosts({ page: 1, limit: 10, isAdmin: false });
      expect(publicList.items.some((p) => p.id === pubPost.id)).toBe(true);
      expect(publicList.items.some((p) => p.id === draftPost.id)).toBe(false);

      // 4. Tag filter on public list
      const tagFiltered = await BlogService.listPosts({ page: 1, limit: 10, tag: 'unit-tag-devops', isAdmin: false });
      expect(tagFiltered.items.some((p) => p.id === pubPost.id)).toBe(true);

      // 5. Public get by slug returns rendered HTML and increments viewCount
      const initialViews = pubPost.viewCount;
      const publicView = await BlogService.getPostBySlug(pubPost.slug, false, true);
      expect(publicView).toBeDefined();
      expect(publicView?.renderedContent).toContain('<h1>Published Content</h1>');
      expect(publicView?.viewCount).toBe(initialViews + 1);

      // 6. Public get by slug for DRAFT must return null
      const draftView = await BlogService.getPostBySlug(draftPost.slug, false, false);
      expect(draftView).toBeNull();

      // 7. Admin get by slug for DRAFT should succeed
      const adminDraftView = await BlogService.getPostBySlug(draftPost.slug, true, false);
      expect(adminDraftView).toBeDefined();
      expect(adminDraftView?.status).toBe(Status.DRAFT);

      // 8. Update post to PUBLISHED
      const updated = await BlogService.updatePost(draftPost.id, {
        status: Status.PUBLISHED,
      });
      expect(updated.status).toBe(Status.PUBLISHED);

      // 9. Soft-delete
      await BlogService.deletePost(draftPost.id);
      await BlogService.deletePost(pubPost.id);

      const afterDelete = await BlogService.getPostById(draftPost.id);
      expect(afterDelete?.deletedAt).not.toBeNull();
    });
  });
});
