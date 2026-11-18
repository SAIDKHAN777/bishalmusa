import React, { useCallback, useEffect, useState } from 'react';
import { Icons } from './Icons';
import { useToast } from './Toast';

interface AdminStats {
  totalPageViews: number;
  totalResumeDownloads: number;
  uniqueVisitors: number;
  viewsPerDay: Array<{ date: string; views: number }>;
  topPages: Array<{ path: string; views: number }>;
  topProjects: Array<{
    projectId: string;
    title: string;
    slug: string;
    demoClicks: number;
    githubClicks: number;
    totalClicks: number;
  }>;
}

export function DashboardStatsView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/analytics/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      } else {
        showToast(data.error?.message || 'Failed to load stats', 'error');
      }
    } catch {
      showToast('Network error while loading analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalInteractions = stats?.topProjects.reduce((acc, p) => acc + (p.totalClicks || 0), 0) ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">
            Real-time portfolio metrics, visitor telemetry, and content management overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('projects')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-brand-500/20 active:scale-95"
          >
            <Icons.Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
          <button
            onClick={() => onNavigate('blog')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition-all active:scale-95"
          >
            <Icons.Pencil className="w-4 h-4" />
            <span>Write Post</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="p-6 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-sm shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Page Views</span>
            <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Icons.Eye className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white tracking-tight" data-testid="stat-pageviews">
              {loading ? '...' : (stats?.totalPageViews ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {loading ? '...' : `${stats?.uniqueVisitors ?? 0} unique visitors (bots excluded)`}
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-6 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-sm shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Project Clicks</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Icons.Projects className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white tracking-tight" data-testid="stat-project-clicks">
              {loading ? '...' : totalInteractions.toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1">Direct live demo & code link clicks</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-6 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-sm shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resume Downloads</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Icons.Document className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white tracking-tight" data-testid="stat-resume-downloads">
              {loading ? '...' : (stats?.totalResumeDownloads ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1">Total recruiter & client downloads</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-6 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-sm shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">System Security</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Icons.Check className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">Active</span>
            <p className="text-xs text-slate-500 mt-1">CSP, HSTS, Rate Limit & Cloudflare</p>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages Table */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Icons.Dashboard className="w-5 h-5 text-brand-400" />
              Most Visited Pages
            </h3>
            <span className="text-xs text-slate-500">Last 30 Days</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-sm">Loading telemetry data...</div>
          ) : stats?.topPages && stats.topPages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                    <th className="pb-3 font-semibold">Route</th>
                    <th className="pb-3 font-semibold text-right">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats.topPages.map((page, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 font-mono text-xs text-slate-300">{page.path}</td>
                      <td className="py-3 text-right font-medium text-white">
                        {(page.views ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-sm">No page views recorded yet.</div>
          )}
        </div>

        {/* Top Clicked Projects */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Icons.Projects className="w-5 h-5 text-emerald-400" />
              Top Engaged Projects
            </h3>
            <span className="text-xs text-slate-500">Interaction Counts</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-sm">Loading project engagement...</div>
          ) : stats?.topProjects && stats.topProjects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                    <th className="pb-3 font-semibold">Project Title</th>
                    <th className="pb-3 font-semibold text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats.topProjects.map((proj, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 font-medium text-slate-200">{proj.title}</td>
                      <td className="py-3 text-right font-semibold text-emerald-400">
                        {(proj.totalClicks ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-sm">No project clicks recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
