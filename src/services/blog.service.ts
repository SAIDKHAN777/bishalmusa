import { db } from '../lib/db';
import { Status, type Prisma } from '@prisma/client';
import { calculateReadingTime, generateSlug, renderMarkdown } from '../lib/markdown';
import type { CreateBlogPostInput, UpdateBlogPostInput, BlogQuery } from '../lib/validators/blog';

export class BlogService {
  private static async resolveUniqueSlug(baseSlug: string, currentId?: string): Promise<string> {
    let slug = baseSlug;
    let count = 1;

    while (true) {
      const existing = await db.blogPost.findFirst({
        where: {
          slug,
          deletedAt: null,
          ...(currentId ? { NOT: { id: currentId } } : {}),
        },
      });

      if (!existing) break;
      count += 1;
      slug = `${baseSlug}-${count}`;
    }

    return slug;
  }

  static async listPosts(params: BlogQuery & { isAdmin?: boolean }) {
    const { page = 1, limit = 20, search, tag, status, isAdmin = false } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BlogPostWhereInput = {
      deletedAt: null,
    };

    if (!isAdmin) {
      where.status = Status.PUBLISHED;
    } else if (status) {
      where.status = status;
    }

    if (tag) {
      where.tags = {
        some: {
          slug: tag.toLowerCase(),
        },
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      db.blogPost.findMany({
        where,
        include: {
          tags: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.blogPost.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPostBySlug(slug: string, isAdmin = false, incrementView = true) {
    const post = await db.blogPost.findFirst({
      where: { slug, deletedAt: null },
      include: {
        tags: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!post) return null;

    if (!isAdmin && post.status !== Status.PUBLISHED) {
      return null;
    }

    if (incrementView && post.status === Status.PUBLISHED) {
      await db.blogPost.update({
        where: { id: post.id },
        data: { viewCount: { increment: 1 } },
      });
      post.viewCount += 1;
    }

    // Render markdown to sanitized HTML for presentation
    const renderedContent = await renderMarkdown(post.content);

    return {
      ...post,
      renderedContent,
    };
  }

  static async getPostById(id: string) {
    return db.blogPost.findFirst({
      where: { id, deletedAt: null },
      include: {
        tags: true,
      },
    });
  }

  static async createPost(data: CreateBlogPostInput) {
    const { title, content, tags = [], slug: explicitSlug, status = Status.DRAFT, publishedAt, ...rest } = data;

    const baseSlug = explicitSlug ? generateSlug(explicitSlug) : generateSlug(title);
    const slug = await this.resolveUniqueSlug(baseSlug);
    const readingTimeMinutes = calculateReadingTime(content);

    const actualPublishedAt =
      status === Status.PUBLISHED ? (publishedAt ?? new Date()) : publishedAt;

    // Connect or create tags
    const tagConnect = tags.map((name) => {
      const tagSlug = generateSlug(name);
      return {
        where: { slug: tagSlug },
        create: { name: name.trim(), slug: tagSlug },
      };
    });

    return db.blogPost.create({
      data: {
        title,
        slug,
        content,
        readingTimeMinutes,
        status,
        publishedAt: actualPublishedAt,
        tags: {
          connectOrCreate: tagConnect,
        },
        ...rest,
      },
      include: {
        tags: true,
      },
    });
  }

  static async updatePost(id: string, data: UpdateBlogPostInput) {
    const { title, content, tags, slug: explicitSlug, status, publishedAt, ...rest } = data;

    const updateData: Prisma.BlogPostUpdateInput = { ...rest };

    if (title && !explicitSlug) {
      // If title changed and no explicit slug provided, we keep current slug unless requested
    }

    if (explicitSlug) {
      updateData.slug = await this.resolveUniqueSlug(generateSlug(explicitSlug), id);
    }

    if (content) {
      updateData.content = content;
      updateData.readingTimeMinutes = calculateReadingTime(content);
    }

    if (status) {
      updateData.status = status;
      if (status === Status.PUBLISHED && !publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    if (publishedAt !== undefined) {
      updateData.publishedAt = publishedAt;
    }

    if (tags) {
      updateData.tags = {
        set: [], // Disconnect old tags
        connectOrCreate: tags.map((name) => {
          const tagSlug = generateSlug(name);
          return {
            where: { slug: tagSlug },
            create: { name: name.trim(), slug: tagSlug },
          };
        }),
      };
    }

    return db.blogPost.update({
      where: { id },
      data: updateData,
      include: {
        tags: true,
      },
    });
  }

  static async deletePost(id: string) {
    return db.blogPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Tag Management
  static async listTags() {
    return db.tag.findMany({
      include: {
        _count: {
          select: {
            posts: {
              where: { status: Status.PUBLISHED, deletedAt: null },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async createTag(name: string, explicitSlug?: string) {
    const slug = explicitSlug ? generateSlug(explicitSlug) : generateSlug(name);
    return db.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
  }

  static async deleteTag(id: string) {
    return db.tag.delete({
      where: { id },
    });
  }
}
