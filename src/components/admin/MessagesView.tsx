import React, { useCallback, useEffect, useState } from 'react';
import { Icons } from './Icons';
import { useToast } from './Toast';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  isSpam: boolean;
  createdAt: string;
}

export function MessagesView() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { showToast } = useToast();

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/messages');
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch {
      showToast('Error loading messages', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleToggleRead = async (msg: ContactMessage) => {
    try {
      const res = await fetch(`/api/admin/messages/${msg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: !msg.read }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(msg.read ? 'Marked as unread' : 'Marked as read');
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, read: !msg.read } : m))
        );
        if (selectedMessage?.id === msg.id) {
          setSelectedMessage((prev) => (prev ? { ...prev, read: !msg.read } : null));
        }
      }
    } catch {
      showToast('Failed to update message status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Message deleted successfully');
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setDeleteConfirmId(null);
        if (selectedMessage?.id === id) {
          setSelectedMessage(null);
        }
      } else {
        showToast(data.error?.message || 'Delete failed', 'error');
      }
    } catch {
      showToast('Network error while deleting message', 'error');
    }
  };

  const handleOpenMessage = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    if (!msg.read) {
      handleToggleRead(msg);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Client Inbox</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Incoming contact form messages, potential client inquiries, and spam filtering.
          </p>
        </div>
        <button
          onClick={fetchMessages}
          className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-colors"
        >
          Refresh Inbox
        </button>
      </div>

      {/* Messages Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="table-messages">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-xs text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Sender</th>
                <th className="py-3.5 px-4 font-semibold">Subject & Message</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Date</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    Loading messages...
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No inquiries received yet.
                  </td>
                </tr>
              ) : (
                messages.map((m) => (
                  <tr
                    key={m.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      !m.read ? 'bg-brand-950/10 font-medium' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="text-white font-semibold">{m.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{m.email}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="text-slate-200 font-medium truncate">{m.subject}</div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{m.message}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {m.isSpam ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            SPAM
                          </span>
                        ) : !m.read ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                            NEW
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            READ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-400 font-mono">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenMessage(m)}
                          data-testid="btn-view-message"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          title="Read Message"
                        >
                          <Icons.Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(m.id)}
                          data-testid="btn-delete-message"
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete Message"
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

      {/* View Message Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Icons.Messages className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-bold text-white">Message Details</h3>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <Icons.XMark className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-800/80">
                <div>
                  <span className="text-xs uppercase text-slate-500 font-semibold">From</span>
                  <p className="text-sm font-semibold text-white mt-0.5">{selectedMessage.name}</p>
                  <p className="text-xs text-brand-400 font-mono mt-0.5">{selectedMessage.email}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase text-slate-500 font-semibold">Received</span>
                  <p className="text-xs text-slate-300 font-mono mt-0.5">
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs uppercase text-slate-500 font-semibold">Subject</span>
                <p className="text-base font-bold text-white mt-0.5">{selectedMessage.subject}</p>
              </div>

              <div>
                <span className="text-xs uppercase text-slate-500 font-semibold">Message Body</span>
                <div className="mt-2 p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.message}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <button
                onClick={() => handleToggleRead(selectedMessage)}
                className="text-xs text-slate-400 hover:text-white"
              >
                {selectedMessage.read ? 'Mark as Unread' : 'Mark as Read'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"
                >
                  Close
                </button>
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(
                    selectedMessage.subject
                  )}`}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium"
                >
                  Reply via Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h4 className="text-lg font-bold text-white">Delete Message?</h4>
            <p className="text-sm text-slate-400 mt-2">
              This message will be permanently removed from your inbox.
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
