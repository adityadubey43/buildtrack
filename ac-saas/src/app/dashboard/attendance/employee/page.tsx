"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type AttendanceRecord, type Worker, type Project, type MonthlySummaryRow } from "@/lib/api";
import { uploadFiles } from "@/lib/uploadApi";
import { AddWorkerModal } from "@/components/workerModal";
import { MyAttendanceCard } from "@/components/selfAttendance";
import { ViewPhotosButton } from "@/components/imageViewer";
import { getUser } from "@/lib/store";
import { canSeeFinance } from "@/lib/permissions";
import {
  Plus, Download, X, Calendar, UserPlus, UserCheck, Camera, Loader2,
  LogIn, LogOut, Clock,
} from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function todayStr() { return new Date().toISOString().split("T")[0]; }

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  present: { label: "Present", cls: "bg-green-100 text-green-700" },
  absent: { label: "Absent", cls: "bg-red-100 text-red-700" },
  leave: { label: "Leave", cls: "bg-blue-100 text-blue-700" },
  "half-day": { label: "Half Day", cls: "bg-orange-100 text-orange-700" },
  late: { label: "Late", cls: "bg-yellow-100 text-yellow-700" },
};

// ── Check-in / Check-out photo modal (name locked) ──
function CheckPhotoModal({ staffName, action, onUpload, onClose }: {
  staffName: string;
  action: "checkin" | "checkout";
  onUpload: (photoUrl: string) => Promise<void>;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const isIn = action === "checkin";

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    setUploading(true); setErr("");
    try { const urls = await uploadFiles(files, "attendance"); setPhoto(urls[0]); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!photo) { setErr("Photo is required."); return; }
    setSaving(true); setErr("");
    try { await onUpload(photo); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed."); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">{isIn ? "Check In" : "Check Out"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}
          {/* Name locked */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Staff Member</label>
            <input value={staffName} readOnly disabled className="w-full border border-slate-200 bg-slate-50 text-slate-700 rounded-lg px-3 py-2 text-sm cursor-not-allowed font-medium" />
          </div>
          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{isIn ? "Check-in" : "Check-out"} Photo *</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            {photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="proof" className="w-full h-44 object-cover rounded-xl border border-slate-200" />
                <button type="button" onClick={() => setPhoto("")} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 disabled:opacity-60">
                {uploading ? <Loader2 className="w-8 h-8 text-blue-400 mx-auto animate-spin" /> : <><Camera className="w-8 h-8 text-slate-400 mx-auto mb-1" /><p className="text-sm text-slate-500">Capture / upload photo</p></>}
              </button>
            )}
          </div>
          <button onClick={submit} disabled={saving || uploading || !photo} className={`w-full py-2.5 ${isIn ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"} disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2`}>
            {saving ? "Saving…" : <>{isIn ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}{isIn ? "Confirm Check In" : "Confirm Check Out"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manual Mark modal (admin/accountant fallback — all fields) ──
function MarkModal({ workers, projects, onClose, onSaved }: {
  workers: Worker[]; projects: Project[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ project: "", worker: "", status: "present", date: todayStr(), timeIn: "", timeOut: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project || !form.worker) { setErr("Site and staff member are required."); return; }
    setSaving(true); setErr("");
    try {
      await api.attendance.mark([{
        worker: form.worker, project: form.project, attendanceType: "employee",
        date: form.date, status: form.status, timeIn: form.timeIn, timeOut: form.timeOut,
      }]);
      onSaved(); onClose();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Mark Staff Attendance</h2>
            <p className="text-xs text-slate-400">Admin fallback — for staff who couldn&apos;t check in</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site / Office *</label>
              <select value={form.project} onChange={(e) => set("project", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required>
                <option value="">Select…</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Staff Member *</label>
            <select value={form.worker} onChange={(e) => set("worker", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required>
              <option value="">Select…</option>
              {workers.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.role})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {["present", "absent", "leave"].map((s) => (
                <button type="button" key={s} onClick={() => set("status", s)} className={`py-2 rounded-lg text-sm font-medium capitalize border ${form.status === s ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check-in (optional)</label>
              <input type="time" value={form.timeIn} onChange={(e) => set("timeIn", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check-out (optional)</label>
              <input type="time" value={form.timeOut} onChange={(e) => set("timeOut", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">{saving ? "Saving…" : "Mark Attendance"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmployeeAttendancePage() {
  const now = new Date();
  const user = getUser();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);
  const [todayMap, setTodayMap] = useState<Record<string, AttendanceRecord>>({});
  const [summary, setSummary] = useState<MonthlySummaryRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [view, setView] = useState<"today" | "monthly" | "daily">("today");
  const [loading, setLoading] = useState(true);
  const [loadingCurrentWorker, setLoadingCurrentWorker] = useState(true);

  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [fallbackSite, setFallbackSite] = useState("");

  const [showMark, setShowMark] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [check, setCheck] = useState<{ worker: Worker; action: "checkin" | "checkout" } | null>(null);

  const [role, setRole] = useState("");
  useEffect(() => { setRole(user?.role || ""); }, [user]);
  const canManualMark = role === "admin" || role === "accountant";
  const showFinance = canSeeFinance(role);

  // Load current user's worker record for self check-in
  useEffect(() => {
    const loadCurrentWorker = async () => {
      try {
        const res = await api.workers.me();
        setCurrentWorker(res.data);
      } catch {
        setCurrentWorker(null);
      } finally {
        setLoadingCurrentWorker(false);
      }
    };
    loadCurrentWorker();
  }, []);

  const loadRef = useCallback(async () => {
    const [wRes, pRes] = await Promise.all([
      api.workers.list({ workerType: "employee", limit: "200" } as Record<string, string>).catch(() => ({ data: [] as Worker[] })),
      api.projects.list({ status: "active", limit: "100" } as Record<string, string>).catch(() => ({ data: [] as Project[] })),
    ]);
    setWorkers(wRes.data); setProjects(pRes.data);
    if (pRes.data[0]) setFallbackSite((s) => s || pRes.data[0]._id);
  }, []);

  const loadToday = useCallback(async () => {
    try {
      const res = await api.attendance.list({ type: "employee", date: todayStr() });
      const map: Record<string, AttendanceRecord> = {};
      res.data.forEach((r) => { if (r.worker?._id) map[r.worker._id] = r; });
      setTodayMap(map);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const loadMonthly = useCallback(async () => {
    try {
      const res = await api.attendance.monthlySummary({ type: "employee", month: String(month), year: String(year) });
      setSummary(res.data); setDaysInMonth(res.daysInMonth);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [month, year]);

  const loadDaily = useCallback(async () => {
    try {
      const res = await api.attendance.list({ type: "employee", startDate: from, endDate: to });
      setRecords(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { loadRef(); }, [loadRef]);
  useEffect(() => {
    if (view === "today") loadToday();
    else if (view === "monthly") loadMonthly();
    else loadDaily();
  }, [view, loadToday, loadMonthly, loadDaily]);

  const handleCheck = async (photoUrl: string) => {
    if (!check) return;
    const project = check.worker.assignedSite?._id || fallbackSite || undefined;
    if (check.action === "checkin") await api.attendance.checkIn({ worker: check.worker._id, project, photoUrl });
    else await api.attendance.checkOut({ worker: check.worker._id, project, photoUrl });
    await loadToday();
  };

  const exportCSV = () => {
    const head = ["Employee", "Role", "Present", "Leave", "Absent", "Total Hours"];
    if (showFinance) head.push("Monthly Salary");
    const rows = [head];
    summary.forEach((s) => {
      const r = [s.name, s.role, String(s.present), String(s.leave), String(s.absent), String(s.totalHours)];
      if (showFinance) r.push(String(s.monthlySalary));
      rows.push(r);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `staff-attendance-${MONTHS[month]}-${year}.csv`;
    a.click();
  };

  const years = [now.getFullYear(), now.getFullYear() - 1];

  return (
    <>
      {check && (
        <CheckPhotoModal
          staffName={check.worker.name}
          action={check.action}
          onUpload={handleCheck}
          onClose={() => setCheck(null)}
        />
      )}
      {showMark && <MarkModal workers={workers} projects={projects} onClose={() => setShowMark(false)} onSaved={() => { loadToday(); }} />}
      {showAdd && <AddWorkerModal workerType="employee" projects={projects} onClose={() => setShowAdd(false)} onSaved={loadRef} />}

      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Staff Attendance</h1>
            <p className="text-slate-500 text-sm">Salaried employees · check-in / check-out with photo · {workers.length} staff</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
              <UserPlus className="w-4 h-4" /> Add Staff
            </button>
            {canManualMark && (
              <button onClick={() => setShowMark(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30">
                <UserCheck className="w-4 h-4" /> Mark Attendance
              </button>
            )}
          </div>
        </div>

        {/* Self check-in / check-out (own name locked) */}
        <MyAttendanceCard />

        {/* View tabs */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-end gap-3">
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setView("today")} className={`px-3 py-2 text-sm ${view === "today" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Today</button>
            <button onClick={() => setView("monthly")} className={`px-3 py-2 text-sm ${view === "monthly" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Monthly Summary</button>
            <button onClick={() => setView("daily")} className={`px-3 py-2 text-sm ${view === "daily" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Daily Records</button>
          </div>

          {view === "monthly" && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Month</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Year</label>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm">
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={exportCSV} className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                <Download className="w-4 h-4" /> Export
              </button>
            </>
          )}
          {view === "daily" && (
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
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : view === "today" ? (
            workers.length === 0 ? (
              <div className="p-12 text-center text-slate-400"><UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No staff yet. Add staff members to start.</p></div>
            ) : (
              <div className="divide-y divide-slate-50">
                <div className="px-4 py-2.5 text-xs text-slate-400 bg-slate-50 flex">
                  <span className="flex-1">Staff Member</span>
                  <span className="w-20 text-center">Check-in</span>
                  <span className="w-20 text-center">Check-out</span>
                  <span className="w-20 text-center">Hours</span>
                  <span className="w-16 text-center">Photos</span>
                  <span className="w-44 text-right">Action</span>
                </div>
                {workers.map((w) => {
                  const rec = todayMap[w._id];
                  const checkedIn = !!rec?.checkInAt;
                  const checkedOut = !!rec?.checkOutAt;
                  return (
                    <div key={w._id} className="px-4 py-3 flex items-center hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{w.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{w.role}</p>
                      </div>
                      <span className="w-20 text-center text-sm text-slate-600">{rec?.timeIn || "—"}</span>
                      <span className="w-20 text-center text-sm text-slate-600">{rec?.timeOut || "—"}</span>
                      <span className="w-20 text-center text-sm font-semibold text-slate-800">{checkedOut ? `${rec?.hoursWorked ?? 0}h` : "—"}</span>
                      <div className="w-16 flex justify-center">
                        <ViewPhotosButton variant="thumb" images={[
                          { url: rec?.checkInPhoto || "", label: "Check-in photo" },
                          { url: rec?.checkOutPhoto || "", label: "Check-out photo" },
                        ]} />
                      </div>
                      <div className="w-44 flex justify-end gap-2">
                        {checkedOut ? (
                          <span className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" /> Done
                          </span>
                        ) : canManualMark ? (
                          !checkedIn ? (
                            <button onClick={() => setCheck({ worker: w, action: "checkin" })} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold">
                              <LogIn className="w-3.5 h-3.5" /> Check In
                            </button>
                          ) : (
                            <button onClick={() => setCheck({ worker: w, action: "checkout" })} className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold">
                              <LogOut className="w-3.5 h-3.5" /> Check Out
                            </button>
                          )
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${checkedIn ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-400"}`}>
                            {checkedIn ? "Checked in" : "Not in"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : view === "monthly" ? (
            summary.length === 0 ? (
              <div className="p-12 text-center text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No staff attendance for {MONTHS[month]} {year}.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">{MONTHS[month]} {year} · {daysInMonth} days</div>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                    <th className="py-2.5 px-4 font-medium">Employee</th><th className="py-2.5 px-3 font-medium">Role</th>
                    <th className="py-2.5 px-3 font-medium">Present</th><th className="py-2.5 px-3 font-medium">Leave</th>
                    <th className="py-2.5 px-3 font-medium">Absent</th><th className="py-2.5 px-3 font-medium">Total Hours</th>
                    {showFinance && <th className="py-2.5 px-3 font-medium">Monthly Salary</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {summary.map((s) => (
                      <tr key={s.workerId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-medium text-slate-800">{s.name}</td>
                        <td className="py-2.5 px-3 text-slate-500 capitalize">{s.role}</td>
                        <td className="py-2.5 px-3"><span className="text-green-700 font-semibold">{s.present}</span></td>
                        <td className="py-2.5 px-3"><span className="text-blue-600">{s.leave}</span></td>
                        <td className="py-2.5 px-3"><span className="text-red-600">{s.absent}</span></td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{s.totalHours}h</td>
                        {showFinance && <td className="py-2.5 px-3 text-slate-700">₹{(s.monthlySalary || 0).toLocaleString("en-IN")}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
                  Pay is a fixed monthly salary{showFinance ? "" : " (hidden for your role)"}; total hours are shown for reference only.
                </p>
              </div>
            )
          ) : (
            records.length === 0 ? (
              <div className="p-12 text-center text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No records for this range.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                    <th className="py-2.5 px-4 font-medium">Employee</th><th className="py-2.5 px-3 font-medium">Date</th>
                    <th className="py-2.5 px-3 font-medium">Check-in</th><th className="py-2.5 px-3 font-medium">Check-out</th>
                    <th className="py-2.5 px-3 font-medium">Hours</th><th className="py-2.5 px-3 font-medium">Photos</th><th className="py-2.5 px-3 font-medium">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {records.map((r) => {
                      const cfg = STATUS_CFG[r.status] || STATUS_CFG.present;
                      return (
                        <tr key={r._id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-medium text-slate-800">{r.worker?.name || "—"}</td>
                          <td className="py-2.5 px-3 text-slate-500">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                          <td className="py-2.5 px-3 text-slate-500">{r.timeIn || "—"}</td>
                          <td className="py-2.5 px-3 text-slate-500">{r.timeOut || "—"}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{r.hoursWorked ? `${r.hoursWorked}h` : "—"}</td>
                          <td className="py-2.5 px-3">
                            <ViewPhotosButton images={[
                              { url: r.checkInPhoto || "", label: "Check-in photo" },
                              { url: r.checkOutPhoto || "", label: "Check-out photo" },
                            ]} />
                          </td>
                          <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span></td>
                        </tr>
                      );
                    })}
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
