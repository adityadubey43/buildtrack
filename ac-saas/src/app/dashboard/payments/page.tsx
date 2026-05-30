"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type PaymentReceived, type Project } from "@/lib/api";
import { AddPaymentModal } from "@/components/financeModals";
import { Plus, Wallet, Filter } from "lucide-react";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const MODE_COLORS: Record<string, string> = {
  cash: "bg-yellow-100 text-yellow-700",
  bank: "bg-blue-100 text-blue-700",
  upi: "bg-violet-100 text-violet-700",
  cheque: "bg-slate-100 text-slate-700",
  razorpay: "bg-indigo-100 text-indigo-700",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentReceived[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [filterProject, setFilterProject] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.projects.list({ status: "active", limit: "100" } as Record<string, string>);
      setProjects(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadPayments = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterProject) params.project = filterProject;
    if (filterFrom) params.startDate = filterFrom;
    if (filterTo) params.endDate = filterTo;
    try {
      const res = await api.payments.list(params);
      setPayments(res.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filterProject, filterFrom, filterTo]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadPayments(); }, [loadPayments]);

  const clearFilters = () => { setFilterProject(""); setFilterFrom(""); setFilterTo(""); };

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const hasFilters = filterProject || filterFrom || filterTo;

  return (
    <>
      {showModal && (
        <AddPaymentModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={loadPayments}
        />
      )}

      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Payments Received</h1>
            <p className="text-slate-500 text-sm mt-0.5">Track client payments across all projects</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-green-600/30"
          >
            <Plus className="w-4 h-4" />
            Add Payment
          </button>
        </div>

        {/* Total card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{formatINR(total)}</div>
            <div className="text-slate-500 text-xs">
              {hasFilters ? "Filtered total" : "Total received"} · {payments.length} {payments.length === 1 ? "payment" : "payments"}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-3 text-slate-600">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-orange-500 hover:underline ml-auto">
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Site</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-green-400"
              >
                <option value="">All Sites</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To Date</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
          </div>
        </div>

        {/* Payment list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">All Payments Received</h2>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{hasFilters ? "No payments match your filters." : "No payments received yet."}</p>
              {!hasFilters && (
                <button onClick={() => setShowModal(true)} className="text-green-600 text-sm hover:underline mt-1">
                  Add your first payment →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {payments.map((pay) => (
                <div key={pay._id} className="flex items-center gap-3 px-4 lg:px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 w-20 text-center ${MODE_COLORS[pay.paymentMode] || "bg-slate-100 text-slate-600"}`}>
                    {pay.paymentMode}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{pay.clientName}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {(pay.project as { name?: string })?.name ?? "—"}
                      {pay.milestone ? ` · ${pay.milestone}` : ""}
                      {pay.reference ? ` · Ref: ${pay.reference}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-green-600">{formatINR(pay.amount)}</p>
                    <p className="text-xs text-slate-400">{new Date(pay.date).toLocaleDateString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
