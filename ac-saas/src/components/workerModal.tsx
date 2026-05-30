"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { api, type Project } from "@/lib/api";

const LABOUR_ROLES = ["labour", "mason", "helper", "contractor", "electrician", "plumber", "other"];
const EMPLOYEE_ROLES = ["engineer", "supervisor", "accountant", "office-staff", "other"];

export function AddWorkerModal({
  workerType,
  projects,
  onClose,
  onSaved,
}: {
  workerType: "labour" | "employee";
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isLabour = workerType === "labour";
  const [form, setForm] = useState({
    name: "",
    phone: "",
    role: isLabour ? "labour" : "engineer",
    dailyWage: "",
    monthlySalary: "",
    assignedSite: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setErr("Name is required."); return; }
    setSaving(true);
    setErr("");
    try {
      await api.workers.create({
        name: form.name,
        phone: form.phone,
        role: form.role,
        workerType,
        wageType: isLabour ? "daily" : "monthly",
        dailyWage: isLabour ? Number(form.dailyWage) || 0 : 0,
        monthlySalary: !isLabour ? Number(form.monthlySalary) || 0 : 0,
        assignedSite: form.assignedSite || undefined,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const roles = isLabour ? LABOUR_ROLES : EMPLOYEE_ROLES;
  const ring = isLabour ? "focus:ring-orange-400" : "focus:ring-blue-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">{isLabour ? "Add Site Worker" : "Add Staff Member"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91…" className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
              <select value={form.role} onChange={(e) => set("role", e.target.value)} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 ${ring}`}>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {isLabour ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daily Wage (₹)</label>
              <input type="number" min="0" value={form.dailyWage} onChange={(e) => set("dailyWage", e.target.value)} placeholder="700" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Salary (₹)</label>
              <input type="number" min="0" value={form.monthlySalary} onChange={(e) => set("monthlySalary", e.target.value)} placeholder="35000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Site (optional)</label>
            <select value={form.assignedSite} onChange={(e) => set("assignedSite", e.target.value)} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`}>
              <option value="">No default site</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className={`flex-1 px-4 py-2.5 ${isLabour ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700"} disabled:opacity-50 text-white rounded-xl text-sm font-semibold`}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
