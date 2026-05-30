"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type AttendanceRecord, type Worker, type Project, type WeeklySummaryRow } from "@/lib/api";
import { uploadFiles } from "@/lib/uploadApi";
import { AddWorkerModal } from "@/components/workerModal";
import { ViewPhotosButton } from "@/components/imageViewer";
import {
  Camera, Plus, Download, X, CheckCircle, XCircle, Clock, Loader2,
  UserPlus, CalendarDays, MapPin,
} from "lucide-react";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(s: string, n: number) {
  const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0];
}
function startOfWeek() {
  const d = new Date(); const day = d.getDay(); const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff); return d.toISOString().split("T")[0];
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  present: { label: "Present", cls: "bg-green-100 text-green-700", icon: CheckCircle },
  absent: { label: "Absent", cls: "bg-red-100 text-red-700", icon: XCircle },
  late: { label: "Late", cls: "bg-yellow-100 text-yellow-700", icon: Clock },
  "half-day": { label: "Half Day", cls: "bg-orange-100 text-orange-700", icon: Clock },
};

// ── Mark Attendance Modal (Labour — photo mandatory) ──
function MarkModal({ workers, projects, onClose, onSaved }: {
  workers: Worker[]; projects: Project[]; onClose: () => void; onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ project: "", worker: "", status: "present", date: todayStr(), timeIn: "", overtimeHours: "" });
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    setUploading(true); setErr("");
    try { const urls = await uploadFiles(files, "attendance"); setPhoto(urls[0]); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project || !form.worker) { setErr("Site and worker are required."); return; }
    if (form.status !== "absent" && !photo) { setErr("Photo proof is mandatory."); return; }
    setSaving(true); setErr("");
    try {
      await api.attendance.mark([{
        worker: form.worker, project: form.project, attendanceType: "labour",
        date: form.date, status: form.status, timeIn: form.timeIn,
        overtimeHours: Number(form.overtimeHours) || 0, photoUrl: photo,
      }]);
      onSaved(); onClose();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">Mark Labour Attendance</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site *</label>
              <select value={form.project} onChange={(e) => set("project", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required>
                <option value="">Select…</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Worker *</label>
            <select value={form.worker} onChange={(e) => set("worker", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required>
              <option value="">Select worker…</option>
              {workers.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.role})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half-day">Half Day</option>
                <option value="absent">Absent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time In</label>
              <input type="time" value={form.timeIn} onChange={(e) => set("timeIn", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">OT (hrs)</label>
              <input type="number" min="0" value={form.overtimeHours} onChange={(e) => set("overtimeHours", e.target.value)} placeholder="0" className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
          {/* Photo proof */}
          {form.status !== "absent" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Photo Proof * (mandatory)</label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              {photo ? (
                <div className="relative w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="proof" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                  <button type="button" onClick={() => setPhoto("")} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:border-orange-400 disabled:opacity-60">
                  {uploading ? <Loader2 className="w-7 h-7 text-orange-400 mx-auto animate-spin" /> : <><Camera className="w-7 h-7 text-slate-400 mx-auto mb-1" /><p className="text-sm text-slate-500">Capture photo</p></>}
                </button>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">{saving ? "Saving…" : "Mark Attendance"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LabourAttendancePage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [weekly, setWeekly] = useState<WeeklySummaryRow[]>([]);
  const [view, setView] = useState<"list" | "weekly">("list");
  const [loading, setLoading] = useState(true);

  const [quick, setQuick] = useState<"today" | "yesterday" | "week" | "custom">("today");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [site, setSite] = useState("");

  const [showMark, setShowMark] = useState(false);
  const [showAddWorker, setShowAddWorker] = useState(false);

  // Quick filter → date range
  useEffect(() => {
    if (quick === "today") { setFrom(todayStr()); setTo(todayStr()); }
    else if (quick === "yesterday") { setFrom(addDays(todayStr(), -1)); setTo(addDays(todayStr(), -1)); }
    else if (quick === "week") { setFrom(startOfWeek()); setTo(todayStr()); }
  }, [quick]);

  const loadRef = useCallback(async () => {
    const [wRes, pRes] = await Promise.all([
      api.workers.list({ workerType: "labour", limit: "200" } as Record<string, string>).catch(() => ({ data: [] as Worker[] })),
      api.projects.list({ status: "active", limit: "100" } as Record<string, string>).catch(() => ({ data: [] as Project[] })),
    ]);
    setWorkers(wRes.data); setProjects(pRes.data);
  }, []);

  const loadData = useCallback(async () => {
    const params: Record<string, string> = { type: "labour", startDate: from, endDate: to };
    if (site) params.project = site;
    try {
      if (view === "list") {
        const res = await api.attendance.list(params);
        setRecords(res.data);
      } else {
        const res = await api.attendance.weeklySummary(params);
        setWeekly(res.data);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [from, to, site, view]);

  useEffect(() => { loadRef(); }, [loadRef]);
  useEffect(() => { loadData(); }, [loadData]);

  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const half = records.filter((r) => r.status === "half-day").length;

  const exportCSV = () => {
    const rows = [["Worker", "Role", "Site", "Date", "Status", "OT(hrs)"]];
    records.forEach((r) => rows.push([
      r.worker?.name || "", r.worker?.role || "", r.project?.name || "",
      new Date(r.date).toLocaleDateString("en-IN"), r.status, String(r.overtimeHours || 0),
    ]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `labour-attendance-${from}_${to}.csv`;
    a.click();
  };

  const QUICK: { id: typeof quick; label: string }[] = [
    { id: "today", label: "Today" }, { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "This Week" }, { id: "custom", label: "Custom Range" },
  ];

  return (
    <>
      {showMark && <MarkModal workers={workers} projects={projects} onClose={() => setShowMark(false)} onSaved={loadData} />}
      {showAddWorker && <AddWorkerModal workerType="labour" projects={projects} onClose={() => setShowAddWorker(false)} onSaved={loadRef} />}

      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Site Workers</h1>
            <p className="text-slate-500 text-sm">Labour attendance · daily wage workers · {workers.length} workers</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddWorker(true)} className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
              <UserPlus className="w-4 h-4" /> Add Worker
            </button>
            <button onClick={() => setShowMark(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/30">
              <Camera className="w-4 h-4" /> Mark Attendance
            </button>
          </div>
        </div>

        {/* Quick filters */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q.id} onClick={() => setQuick(q.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${quick === q.id ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {q.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {quick === "custom" && (
              <>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">From</label>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">To</label>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Site</label>
              <select value={site} onChange={(e) => setSite(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm">
                <option value="">All Sites</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setView("list")} className={`px-3 py-2 text-sm ${view === "list" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Records</button>
                <button onClick={() => setView("weekly")} className={`px-3 py-2 text-sm ${view === "weekly" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Weekly Summary</button>
              </div>
              <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards (list view) */}
        {view === "list" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Present", value: present, cls: "text-green-700 bg-green-50" },
              { label: "Absent", value: absent, cls: "text-red-600 bg-red-50" },
              { label: "Late", value: late, cls: "text-yellow-700 bg-yellow-50" },
              { label: "Half Day", value: half, cls: "text-orange-700 bg-orange-50" },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl p-4 ${s.cls}`}>
                <div className="text-2xl font-black">{s.value}</div>
                <div className="text-xs font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : view === "list" ? (
            records.length === 0 ? (
              <div className="p-12 text-center text-slate-400"><CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No attendance records for this period.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                    <th className="py-2.5 px-4 font-medium">Worker</th><th className="py-2.5 px-3 font-medium">Role</th>
                    <th className="py-2.5 px-3 font-medium">Site</th><th className="py-2.5 px-3 font-medium">Date</th>
                    <th className="py-2.5 px-3 font-medium">Photo</th><th className="py-2.5 px-3 font-medium">OT</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {records.map((r) => {
                      const cfg = STATUS_CFG[r.status] || STATUS_CFG.present;
                      return (
                        <tr key={r._id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-medium text-slate-800">{r.worker?.name || "—"}</td>
                          <td className="py-2.5 px-3 text-slate-500 capitalize">{r.worker?.role || "—"}</td>
                          <td className="py-2.5 px-3 text-slate-500">{r.project?.name || "—"}</td>
                          <td className="py-2.5 px-3 text-slate-500">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                          <td className="py-2.5 px-3">
                            <ViewPhotosButton variant="thumb" images={[{ url: r.photoUrl || "", label: `${r.worker?.name || ""} · ${new Date(r.date).toLocaleDateString("en-IN")}` }]} />
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{r.overtimeHours ? `${r.overtimeHours}h` : "—"}</td>
                          <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            // Weekly summary
            weekly.length === 0 ? (
              <div className="p-12 text-center text-slate-400"><CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No data for this period.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                    <th className="py-2.5 px-4 font-medium">Worker</th><th className="py-2.5 px-3 font-medium">Role</th>
                    <th className="py-2.5 px-3 font-medium">Days Worked</th><th className="py-2.5 px-3 font-medium">Absent</th>
                    <th className="py-2.5 px-3 font-medium">OT (hrs)</th><th className="py-2.5 px-3 font-medium">Sites</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {weekly.map((w) => (
                      <tr key={w.workerId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-medium text-slate-800">{w.name}</td>
                        <td className="py-2.5 px-3 text-slate-500 capitalize">{w.role}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{w.daysWorked}</td>
                        <td className="py-2.5 px-3 text-red-600">{w.absent}</td>
                        <td className="py-2.5 px-3 text-slate-500">{w.overtimeHours}h</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          <span className="flex items-center gap-1 flex-wrap">
                            <MapPin className="w-3 h-3" />{w.sites.join(", ") || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
