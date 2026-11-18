import React, { useCallback, useEffect, useState } from 'react';
import { Icons } from './Icons';
import { useToast } from './Toast';

interface AdminSkill {
  id: string;
  name: string;
  category: string;
  proficiency?: number;
}

interface AdminService {
  id: string;
  title: string;
  description: string;
}

interface AdminExperience {
  id: string;
  role: string;
  company: string;
}

interface AdminEducation {
  id: string;
  degree: string;
  institution: string;
}

export function SkillsServicesView() {
  const [activeTab, setActiveTab] = useState<'skills' | 'services' | 'experience' | 'education'>('skills');
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [experiences, setExperiences] = useState<AdminExperience[]>([]);
  const [educations, setEducations] = useState<AdminEducation[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Frontend');
  const [proficiency, setProficiency] = useState(85);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [institution, setInstitution] = useState('');
  const [degree, setDegree] = useState('');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('');
  const [current, setCurrent] = useState(false);

  const { showToast } = useToast();

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [skRes, seRes, exRes, edRes] = await Promise.all([
        fetch('/api/admin/skills'),
        fetch('/api/admin/services'),
        fetch('/api/admin/experiences'),
        fetch('/api/admin/educations'),
      ]);

      const skData = await skRes.json();
      const seData = await seRes.json();
      const exData = await exRes.json();
      const edData = await edRes.json();

      if (skData.success) setSkills(skData.data);
      if (seData.success) setServices(seData.data);
      if (exData.success) setExperiences(exData.data);
      if (edData.success) setEducations(edData.data);
    } catch {
      showToast('Error loading skills and services', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName('');
    setCategory('Frontend');
    setProficiency(85);
    setTitle('');
    setDescription('');
    setCompany('');
    setRole('');
    setInstitution('');
    setDegree('');
    setStartDate('2022-01-01');
    setEndDate('');
    setCurrent(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let endpoint = '';
      let payload: Record<string, unknown> = {};

      if (activeTab === 'skills') {
        endpoint = '/api/admin/skills';
        payload = { name, category, proficiency: Number(proficiency) };
      } else if (activeTab === 'services') {
        endpoint = '/api/admin/services';
        payload = { title, description };
      } else if (activeTab === 'experience') {
        endpoint = '/api/admin/experiences';
        payload = {
          role,
          company,
          startDate: new Date(startDate).toISOString(),
          endDate: current || !endDate ? undefined : new Date(endDate).toISOString(),
          current,
          description: description || undefined,
        };
      } else if (activeTab === 'education') {
        endpoint = '/api/admin/educations';
        payload = {
          degree,
          institution,
          startDate: new Date(startDate).toISOString(),
          endDate: current || !endDate ? undefined : new Date(endDate).toISOString(),
          current,
          description: description || undefined,
        };
      }

      const url = editingItem ? `${endpoint}/${editingItem.id}` : endpoint;
      const method = editingItem ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Saved successfully');
        setIsModalOpen(false);
        fetchAll();
      } else {
        showToast(data.error?.message || 'Action failed', 'error');
      }
    } catch {
      showToast('Network error while saving', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      let endpoint = '';
      if (activeTab === 'skills') endpoint = `/api/admin/skills/${id}`;
      if (activeTab === 'services') endpoint = `/api/admin/services/${id}`;
      if (activeTab === 'experience') endpoint = `/api/admin/experiences/${id}`;
      if (activeTab === 'education') endpoint = `/api/admin/educations/${id}`;

      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Deleted successfully');
        setDeleteConfirmId(null);
        fetchAll();
      } else {
        showToast(data.error?.message || 'Delete failed', 'error');
      }
    } catch {
      showToast('Network error while deleting', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Tab Selectors & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          {(['skills', 'services', 'experience', 'education'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <button
          onClick={handleOpenCreate}
          data-testid="btn-add-skill-service"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-500/20 active:scale-95"
        >
          <Icons.Plus className="w-4 h-4" />
          <span>Add {activeTab.slice(0, -1)}</span>
        </button>
      </div>

      {/* Content Container */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading {activeTab}...</div>
        ) : activeTab === 'skills' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-6">
            {skills.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500">No skills added yet.</div>
            ) : (
              skills.map((s) => (
                <div
                  key={s.id}
                  className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {s.category} · {s.proficiency}%
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirmId(s.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'services' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            {services.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500">No services added yet.</div>
            ) : (
              services.map((s) => (
                <div
                  key={s.id}
                  className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="font-bold text-white text-base">{s.title}</div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">{s.description}</p>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => setDeleteConfirmId(s.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                    >
                      <Icons.Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'experience' ? (
          <div className="divide-y divide-slate-800 p-6">
            {experiences.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No work experiences added.</div>
            ) : (
              experiences.map((exp) => (
                <div key={exp.id} className="py-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-base">{exp.role}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{exp.company}</div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirmId(exp.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800 p-6">
            {educations.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No education items added.</div>
            ) : (
              educations.map((edu) => (
                <div key={edu.id} className="py-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-base">{edu.degree}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{edu.institution}</div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirmId(edu.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6">
            <h3 className="text-lg font-bold text-white mb-4">Add {activeTab.slice(0, -1)}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === 'skills' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Skill Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Next.js"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Frontend, Backend, DevOps, AI"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Proficiency (0-100%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={proficiency}
                      onChange={(e) => setProficiency(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                </>
              )}

              {activeTab === 'services' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Service Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Full-Stack Web Development"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Building performant, scalable, and secure modern web architectures..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                </>
              )}

              {activeTab === 'experience' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Role *
                    </label>
                    <input
                      type="text"
                      required
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Lead Software Engineer"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Company *
                    </label>
                    <input
                      type="text"
                      required
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Tech Innovators Inc."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                </>
              )}

              {activeTab === 'education' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Degree *
                    </label>
                    <input
                      type="text"
                      required
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      placeholder="B.Sc. in Computer Science"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Institution *
                    </label>
                    <input
                      type="text"
                      required
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="University of Engineering"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                </>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold"
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
            <h4 className="text-lg font-bold text-white">Confirm Delete</h4>
            <p className="text-sm text-slate-400 mt-2">
              Are you sure you want to delete this item?
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
