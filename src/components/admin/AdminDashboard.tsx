import React, { useState } from 'react';
import { Icons } from './Icons';
import { ToastProvider } from './Toast';
import { DashboardStatsView } from './DashboardStatsView';
import { ProjectsView } from './ProjectsView';
import { BlogView } from './BlogView';
import { SkillsServicesView } from './SkillsServicesView';
import { TestimonialsView } from './TestimonialsView';
import { MessagesView } from './MessagesView';
import { MediaLibraryView } from './MediaLibraryView';
import { SettingsView } from './SettingsView';

interface AdminDashboardProps {
  user?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      window.location.href = '/admin/login';
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'projects', label: 'Projects', icon: Icons.Projects },
    { id: 'blog', label: 'Blog Posts', icon: Icons.Blog },
    { id: 'skills', label: 'Skills & Services', icon: Icons.Skills },
    { id: 'testimonials', label: 'Testimonials', icon: Icons.Testimonials },
    { id: 'messages', label: 'Messages', icon: Icons.Messages },
    { id: 'media', label: 'Media Library', icon: Icons.Media },
    { id: 'settings', label: 'Settings', icon: Icons.Settings },
  ];

  return (
    <ToastProvider>
      <div
        data-hydrated={hydrated ? 'true' : 'false'}
        className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-brand-500 selection:text-white"
      >
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
              SK
            </div>
            <span className="font-bold text-sm tracking-wide text-white">SAID KHAN CMS</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white rounded-lg"
          >
            {isMobileMenuOpen ? <Icons.XMark className="w-6 h-6" /> : <Icons.Dashboard className="w-6 h-6" />}
          </button>
        </div>

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/95 border-r border-slate-800/80 backdrop-blur-xl flex flex-col justify-between transition-transform duration-300 md:static md:translate-x-0 ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Top Brand */}
          <div>
            <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-slate-800/60">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
                SK
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-wide text-white leading-none">Portfolio Admin</h1>
                <p className="text-[11px] text-brand-400 font-mono mt-1">Said Khan CMS v1.0</p>
              </div>
            </div>

            {/* Navigation List */}
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    data-testid={`nav-${item.id}`}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    }`}
                  >
                    <IconComponent className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Sign Out Footer */}
          <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">Active Admin</p>
                <p className="text-[11px] text-slate-500 font-mono truncate">{user?.email || 'admin@saidkhan.dev'}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" title="Online" />
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              id="logoutBtn"
              data-testid="btn-sign-out"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors disabled:opacity-50"
            >
              <Icons.Logout className="w-4 h-4" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-500">Admin</span>
              <span className="text-slate-600">/</span>
              <h2 className="text-sm font-bold text-white capitalize">{activeTab}</h2>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
              >
                <Icons.Eye className="w-3.5 h-3.5 text-brand-400" />
                <span>View Live Site</span>
              </a>
            </div>
          </header>

          {/* Body Content */}
          <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {activeTab === 'dashboard' && <DashboardStatsView onNavigate={setActiveTab} />}
            {activeTab === 'projects' && <ProjectsView />}
            {activeTab === 'blog' && <BlogView />}
            {activeTab === 'skills' && <SkillsServicesView />}
            {activeTab === 'testimonials' && <TestimonialsView />}
            {activeTab === 'messages' && <MessagesView />}
            {activeTab === 'media' && <MediaLibraryView />}
            {activeTab === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
