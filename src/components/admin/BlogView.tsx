import React, { useCallback, useEffect, useState } from 'react';
import { Icons } from './Icons';
import { useToast } from './Toast';

type BlogTagItem = string | { name?: string; tag?: { name?: string } };

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  content: string;
  coverImageUrl?: string | null;
  status: 'PUBLISHED' | 'DRAFT';
  publishedAt?: string | null;
  readingTime?: number | null;
  tags?: BlogTagItem[];
}

export function BlogView() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Editor Modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [published, setPublished] = useState(true);
  const [editorTab, setEditorTab] = useState<'write' | 'preview' | 'split'>('split');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/blog');
      const data = await res.json();
      if (data.success) {
        const items = Array.isArray(data.data)
          ? data.data
          : data.data?.items || [];
        setPosts(items);
      }
    } catch {
      showToast('Error loading blog posts', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleOpenCreate = () => {
    setEditingPost(null);
    setTitle('');
    setSlug('');
    setSummary('');
    setContent('# New Article\n\nStart writing in markdown...');
    setCoverImageUrl('');
    setTagInput('');
    setPublished(true);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (post: BlogPost) => {
    setEditingPost(post);
    setTitle(post.title);
    setSlug(post.slug);
    setSummary(post.summary || '');
    setContent(post.content);
    setCoverImageUrl(post.coverImageUrl || '');
    const tagList = Array.isArray(post.tags)
      ? post.tags.map((t) => (typeof t === 'string' ? t : t.tag?.name || t.name || '')).filter(Boolean).join(', ')
      : '';
    setTagInput(tagList);
    setPublished(post.status === 'PUBLISHED');
    setIsEditorOpen(true);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingPost) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-')
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug || !content) {
      showToast('Title, slug, and content are required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        title,
        slug,
        summary: summary || undefined,
        content,
        status: published ? 'PUBLISHED' : 'DRAFT',
        tags,
      };

      if (coverImageUrl.trim().startsWith('http')) {
        payload.coverImageUrl = coverImageUrl.trim();
      }

      const url = editingPost ? `/api/admin/blog/${editingPost.id}` : '/api/admin/blog';
      const method = editingPost ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(editingPost ? 'Post updated successfully' : 'Post published successfully');
        setIsEditorOpen(false);
        fetchPosts();
      } else {
        showToast(data.error?.message || 'Failed to save post', 'error');
      }
    } catch {
      showToast('Network error while saving post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Blog post deleted successfully');
        setDeleteConfirmId(null);
        fetchPosts();
      } else {
        showToast(data.error?.message || 'Delete failed', 'error');
      }
    } catch {
      showToast('Network error while deleting post', 'error');
    }
  };

  const filteredPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Icons.Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search articles by title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <button
          onClick={handleOpenCreate}
          data-testid="btn-new-blog-post"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg"
        >
          <Icons.Pencil className="w-4 h-4" />
          <span>Write Article</span>
        </button>
      </div>

      {/* Posts Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="table-blog-posts">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-xs text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Title</th>
                <th className="py-3.5 px-4 font-semibold">Tags</th>
                <th className="py-3.5 px-4 font-semibold text-center">Reading Time</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    Loading articles...
                  </td>
                </tr>
              ) : filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No blog posts found. Click "Write Article" to publish your first post.
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{post.title}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">/blog/{post.slug}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(post.tags) && post.tags.length > 0 ? (
                          post.tags.map((t: BlogTagItem, idx: number) => {
                            const name = typeof t === 'string' ? t : t.tag?.name || t.name;
                            return (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-300"
                              >
                                #{name}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-600">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-xs">
                      {post.readingTime ? `${post.readingTime} min read` : '1 min'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          post.status === 'PUBLISHED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {post.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(post)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit Article"
                        >
                          <Icons.Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(post.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete Article"
                        >
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Markdown Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <Icons.Blog className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-bold text-white">
                  {editingPost ? 'Edit Article' : 'Write New Article'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* View Tabs */}
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditorTab('write')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      editorTab === 'write' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      editorTab === 'preview' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('split')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      editorTab === 'split' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                    }`}
                  >
                    Split
                  </button>
                </div>
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg ml-2"
                >
                  <Icons.XMark className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              {/* Metadata Toolbar */}
              <div className="p-4 bg-slate-950/30 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <input
                    type="text"
                    required
                    data-testid="input-blog-title"
                    placeholder="Article Title..."
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-brand-500 font-semibold"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    required
                    data-testid="input-blog-slug"
                    placeholder="slug-url"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Tags (e.g. Nextjs, Astro, AI)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Editor / Live Preview Panes */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-slate-950">
                {/* Write Pane */}
                {(editorTab === 'write' || editorTab === 'split') && (
                  <div className={`h-full flex flex-col ${editorTab === 'write' ? 'col-span-2' : ''}`}>
                    <textarea
                      value={content}
                      required
                      data-testid="textarea-blog-content"
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="# Write your article in markdown..."
                      className="w-full h-full p-4 bg-slate-950 text-slate-200 font-mono text-sm resize-none focus:outline-none focus:ring-0 border-r border-slate-800"
                    />
                  </div>
                )}

                {/* Live Preview Pane */}
                {(editorTab === 'preview' || editorTab === 'split') && (
                  <div
                    className={`h-full overflow-y-auto p-6 bg-slate-900/60 ${
                      editorTab === 'preview' ? 'col-span-2' : ''
                    }`}
                  >
                    <div className="prose prose-invert prose-brand max-w-none text-slate-300">
                      <h1 className="text-2xl font-bold text-white mb-2">{title || 'Untitled Article'}</h1>
                      <div className="text-xs text-slate-500 mb-6 font-mono">
                        Published by Said Khan · Live Rendered Preview
                      </div>
                      <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {content}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-700"
                  />
                  <span className="text-xs font-medium text-slate-300">Publish immediately</span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    data-testid="btn-save-blog-post"
                    className="px-5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold shadow-lg disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingPost ? 'Update Article' : 'Publish Article'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h4 className="text-lg font-bold text-white">Delete Article?</h4>
            <p className="text-sm text-slate-400 mt-2">
              This will remove the article and all associated comments or tags permanently.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
