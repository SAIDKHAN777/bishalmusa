import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Icons } from './Icons';
import { useToast } from './Toast';

interface MediaItem {
  id: string;
  filename: string;
  publicId: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
  createdAt: string;
}

export function MediaLibraryView() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [altText, setAltText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { showToast } = useToast();

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/media');
      const data = await res.json();
      if (data.success) {
        setMedia(data.data);
      }
    } catch {
      showToast('Error loading media assets', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        showToast('Asset uploaded successfully');
        fetchMedia();
      } else {
        showToast(data.error?.message || 'Upload failed', 'error');
      }
    } catch {
      showToast('Network error during upload', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('Asset URL copied to clipboard!');
  };

  const handleSaveAltText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/admin/media/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ altText }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Alt text updated');
        setMedia((prev) =>
          prev.map((m) => (m.id === editingItem.id ? { ...m, altText } : m))
        );
        setEditingItem(null);
      } else {
        showToast(data.error?.message || 'Update failed', 'error');
      }
    } catch {
      showToast('Network error while updating alt text', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/media/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Asset deleted from cloud storage and database');
        setMedia((prev) => prev.filter((m) => m.id !== id));
        setDeleteConfirmId(null);
      } else {
        showToast(data.error?.message || 'Delete failed', 'error');
      }
    } catch {
      showToast('Network error while deleting media', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Upload Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white">Media Library</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Store, optimize, and serve project screenshots, avatars, and resume documents.
          </p>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,application/pdf"
            className="hidden"
            id="media-file-input"
            data-testid="input-media-upload"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="btn-upload-media"
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-500/20 active:scale-95 disabled:opacity-50"
          >
            <Icons.Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
          </button>
        </div>
      </div>

      {/* Media Grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        data-testid="grid-media"
      >
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-500">
            Loading cloud assets...
          </div>
        ) : media.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500">
            No media files uploaded yet. Upload your first image or PDF!
          </div>
        ) : (
          media.map((item) => (
            <div
              key={item.id}
              className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col hover:border-slate-700 transition-all"
            >
              {/* Preview Thumbnail */}
              <div className="aspect-square bg-slate-950 flex items-center justify-center overflow-hidden relative">
                {item.mimeType.startsWith('image/') ? (
                  <img
                    src={item.url}
                    alt={item.altText || item.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-purple-400">
                    <Icons.Document className="w-12 h-12" />
                    <span className="text-[10px] font-mono mt-1 text-slate-400 uppercase">PDF File</span>
                  </div>
                )}

                {/* Hover Action Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                  <button
                    onClick={() => handleCopyUrl(item.url)}
                    className="p-2 bg-slate-800/90 hover:bg-white text-slate-200 hover:text-slate-900 rounded-lg transition-colors shadow-lg"
                    title="Copy URL"
                  >
                    <Icons.Link className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setAltText(item.altText || '');
                    }}
                    className="p-2 bg-slate-800/90 hover:bg-white text-slate-200 hover:text-slate-900 rounded-lg transition-colors shadow-lg"
                    title="Edit Alt Text"
                  >
                    <Icons.Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="p-2 bg-rose-950/90 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg transition-colors shadow-lg"
                    title="Delete Asset"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Asset Info */}
              <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex-1 flex flex-col justify-between">
                <p className="text-xs font-semibold text-slate-200 truncate" title={item.filename}>
                  {item.filename}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-1">
                  <span>{(item.size / 1024).toFixed(1)} KB</span>
                  <span className="uppercase">{item.mimeType.split('/')[1]}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Alt Text Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Accessibility Alt Text</h3>
            <p className="text-xs text-slate-400 mt-1">
              Descriptive text for screen readers and SEO indexing.
            </p>

            <form onSubmit={handleSaveAltText} className="mt-4 space-y-4">
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="e.g., Dashboard interface screenshot showcasing analytics"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h4 className="text-lg font-bold text-white">Delete Asset?</h4>
            <p className="text-sm text-slate-400 mt-2">
              This will remove the file from Cloudinary and database permanently.
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
