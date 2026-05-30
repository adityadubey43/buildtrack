"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type DPR, type Project } from "@/lib/api";
import { uploadFiles } from "@/lib/uploadApi";
import {
  FileText, Plus, Camera, Download, CheckCircle, Clock,
  Image as ImageIcon, Cloud, Sun, CloudRain, X, Loader2,
} from "lucide-react";

const WEATHER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  windy: Cloud,
  foggy: Cloud,
};

// ── Submit DPR Modal ────────────────────────────────────────────────────────────
function SubmitDPRModal({
  projects,
  onClose,
  onSaved,
}: {
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    project: "",
    date: new Date().toISOString().split("T")[0],
    workActivity: "",
    workDescription: "",
    workersPresent: "",
    weather: "sunny",
    hasDelay: false,
    delayReason: "",
  });
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setErr("");
    try {
      const urls = await uploadFiles(files, "dpr");
      setImages((prev) => [...prev, ...urls.map((url) => ({ url }))]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project || !form.workActivity) {
      setErr("Project and work activity are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.dpr.create({
        project: form.project,
        date: form.date,
        workActivity: form.workActivity,
        workDescription: form.workDescription,
        workersPresent: Number(form.workersPresent) || 0,
        weather: form.weather,
        images: images.map((img) => ({ url: img.url, type: "progress" })),
        hasDelay: form.hasDelay,
        delayReason: form.delayReason,
      } as unknown as Partial<DPR>);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to submit DPR.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-900 text-lg">Submit Daily Progress Report</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
              <select
                value={form.project}
                onChange={(e) => set("project", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              >
                <option value="">Select project...</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Work Activity *</label>
            <input
              type="text"
              value={form.workActivity}
              onChange={(e) => set("workActivity", e.target.value)}
              placeholder="e.g. RCC Column Work – Level 4"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Work Description</label>
            <textarea
              value={form.workDescription}
              onChange={(e) => set("workDescription", e.target.value)}
              rows={3}
              placeholder="Describe today's work in detail..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Workers Present</label>
              <input
                type="number"
                min="0"
                value={form.workersPresent}
                onChange={(e) => set("workersPresent", e.target.value)}
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Weather</label>
              <select
                value={form.weather}
                onChange={(e) => set("weather", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="sunny">☀️ Sunny</option>
                <option value="cloudy">☁️ Cloudy</option>
                <option value="rainy">🌧️ Rainy</option>
              </select>
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Site Photos</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-orange-400 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-8 h-8 text-orange-400 mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-slate-500">Uploading...</p>
                </>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Tap to capture or upload photos</p>
                  <p className="text-xs text-slate-400 mt-1">JPG, PNG up to 10 MB each</p>
                </>
              )}
            </button>

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`Site photo ${idx + 1}`} className="w-full h-full object-cover rounded-lg border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-1">
              <input type="checkbox" checked={form.hasDelay} onChange={(e) => set("hasDelay", e.target.checked)} className="rounded" />
              Any delays today?
            </label>
            {form.hasDelay && (
              <input
                type="text"
                value={form.delayReason}
                onChange={(e) => set("delayReason", e.target.value)}
                placeholder="Reason for delay (rain, material shortage, etc.)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {saving ? "Submitting..." : "Submit DPR"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [dprs, setDprs] = useState<DPR[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [missing, setMissing] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dprRes, projRes, missingRes] = await Promise.all([
        api.dpr.list(),
        api.projects.list({ status: "active", limit: "100" } as Record<string, string>),
        api.dpr.missingToday().catch(() => ({ data: [] as Project[] })),
      ]);
      setDprs(dprRes.data);
      setProjects(projRes.data);
      setMissing(missingRes.data);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const todayStr = new Date().toDateString();
  const submittedToday = dprs.filter((d) => new Date(d.date).toDateString() === todayStr).length;
  const totalPhotos = dprs.reduce((s, d) => s + (d.images?.length || 0), 0);

  return (
    <>
      {showModal && (
        <SubmitDPRModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={loadData}
        />
      )}

      <div className="p-4 lg:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daily Progress Reports</h1>
            <p className="text-slate-500 text-sm">{submittedToday} submitted today · {missing.length} missing</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Submit DPR
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-black text-green-700">{submittedToday}</div>
            <div className="text-xs text-green-600 font-medium">Submitted Today</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <Clock className="w-6 h-6 text-red-500 mx-auto mb-1" />
            <div className="text-2xl font-black text-red-600">{missing.length}</div>
            <div className="text-xs text-red-500 font-medium">Missing Today</div>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
            <ImageIcon className="w-6 h-6 text-orange-600 mx-auto mb-1" />
            <div className="text-2xl font-black text-orange-700">{totalPhotos}</div>
            <div className="text-xs text-orange-600 font-medium">Photos Uploaded</div>
          </div>
        </div>

        {/* Missing today */}
        {missing.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <p className="text-sm font-semibold text-red-700 mb-2">⚠ Projects without today&apos;s DPR</p>
            <div className="flex flex-wrap gap-2">
              {missing.map((m) => (
                <button
                  key={m._id}
                  onClick={() => setShowModal(true)}
                  className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                >
                  {m.name} — Submit now
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DPR list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : dprs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No DPRs submitted yet.</p>
            <button onClick={() => setShowModal(true)} className="text-orange-500 text-sm hover:underline mt-1">
              Submit your first DPR →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {dprs.map((dpr) => {
              const WeatherIcon = WEATHER_ICONS[dpr.weather] || Sun;
              return (
                <div key={dpr._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{dpr.project?.name || "Project"}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                          Submitted
                        </span>
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        {new Date(dpr.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mb-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500 mb-0.5">Activity</div>
                      <div className="text-sm font-medium text-slate-800">{dpr.workActivity}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500 mb-0.5">Workers Present</div>
                      <div className="text-sm font-medium text-slate-800">{dpr.workersPresent}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500 mb-0.5">Submitted By</div>
                      <div className="text-sm font-medium text-slate-800">{dpr.submittedBy?.name || "—"}</div>
                    </div>
                  </div>

                  {/* Photos */}
                  {dpr.images && dpr.images.length > 0 && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {dpr.images.map((img, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={idx}
                          src={img.url}
                          alt={`Site ${idx + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 capitalize">
                        <WeatherIcon className="w-3.5 h-3.5" />
                        {dpr.weather}
                      </span>
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {dpr.images?.length || 0} photos
                      </span>
                    </div>
                    {dpr.hasDelay && dpr.delayReason && (
                      <span className="text-yellow-600 font-medium bg-yellow-50 px-2 py-0.5 rounded-full">
                        ⚠ {dpr.delayReason}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
