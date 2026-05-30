"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, type Project } from "@/lib/api";
import { getUser } from "@/lib/store";
import { canSeeFinance } from "@/lib/permissions";
import { Plus, Search, MapPin, Calendar, AlertTriangle, ArrowRight, X } from "lucide-react";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  planning: "bg-blue-100 text-blue-700",
  "on-hold": "bg-yellow-100 text-yellow-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
};

// ── New Project Modal ──────────────────────────────────────────────────────────
function NewProjectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "", location: "", clientName: "", budget: "",
    startDate: new Date().toISOString().split("T")[0], endDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.location || !form.budget || !form.startDate || !form.endDate) {
      setErr("All fields are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.projects.create({ ...form, budget: Number(form.budget) } as unknown as Partial<Project>);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">Create New Project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Skyline Heights Residential" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
              <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Ahmedabad, Gujarat" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
              <input type="text" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Patel Group" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Budget (₹) *</label>
            <input type="number" min="0" value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder="24000000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
              <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
              <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">{saving ? "Creating..." : "Create Project"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showFinance, setShowFinance] = useState(false);

  useEffect(() => { setShowFinance(canSeeFinance(getUser()?.role)); }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.projects.list({ limit: "100" } as Record<string, string>);
      setProjects(res.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onSaved={load} />}

      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-slate-500 text-sm">{projects.length} construction site{projects.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-orange-500/30">
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? "No projects match your search." : "No projects yet."}</p>
            {!search && <button onClick={() => setShowModal(true)} className="text-orange-500 text-sm hover:underline mt-1">Create your first project →</button>}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {filtered.map((project) => {
              const spentPct = project.budget > 0 ? Math.min(100, (project.amountSpent / project.budget) * 100) : 0;
              return (
                <div key={project._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{project.name}</h3>
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {project.location}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize flex-shrink-0 ${STATUS_COLORS[project.status] || "bg-slate-100 text-slate-600"}`}>
                      {project.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.startDate).toLocaleDateString("en-IN")} – {new Date(project.endDate).toLocaleDateString("en-IN")}
                    </span>
                    <span className="font-medium text-slate-700">Phase: {project.currentPhase}</span>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Overall Progress</span>
                      <span className="font-bold text-slate-900">{project.overallProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${project.overallProgress}%` }} />
                    </div>
                  </div>

                  {/* Budget — finance roles only */}
                  {showFinance && (
                    <div className="bg-slate-50 rounded-xl p-3 mb-4">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Spent: {formatINR(project.amountSpent)}</span>
                        <span>Budget: {formatINR(project.budget)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${spentPct > 90 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${spentPct}%` }} />
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/dashboard/projects/${project._id}`}
                    className="mt-auto inline-flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    View Details
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
