"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Expense, type Project } from "@/lib/api";
import { AddExpenseModal } from "@/components/financeModals";
import { Plus, X, TrendingDown, Filter } from "lucide-react";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const TYPE_COLORS: Record<string, string> = {
  labour: "bg-blue-100 text-blue-700",
  material: "bg-orange-100 text-orange-700",
  miscellaneous: "bg-purple-100 text-purple-700",
  travel: "bg-green-100 text-green-700",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [filterProject, setFilterProject] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.projects.list({ status: "active", limit: "100" } as Record<string, string>);
      setProjects(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadExpenses = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterProject) params.project = filterProject;
    if (filterType) params.type = filterType;
    if (filterFrom) params.startDate = filterFrom;
    if (filterTo) params.endDate = filterTo;
    try {
      const res = await api.expenses.list(params);
      setExpenses(res.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filterProject, filterType, filterFrom, filterTo]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await api.expenses.delete(id);
      setExpenses((prev) => prev.filter((e) => e._id !== id));
    } catch {
      alert("Failed to delete expense.");
    }
  };

  const clearFilters = () => {
    setFilterProject(""); setFilterType(""); setFilterFrom(""); setFilterTo("");
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const hasFilters = filterProject || filterType || filterFrom || filterTo;

  return (
    <>
      {showModal && (
        <AddExpenseModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={loadExpenses}
        />
      )}

      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
            <p className="text-slate-500 text-sm mt-0.5">Track site-wise expenses across all projects</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-rose-500/30"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>

        {/* Total card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-600">{formatINR(total)}</div>
            <div className="text-slate-500 text-xs">
              {hasFilters ? "Filtered total" : "Total expenses"} · {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Site</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                <option value="">All Sites</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                <option value="">All Types</option>
                <option value="labour">Labour</option>
                <option value="material">Material</option>
                <option value="miscellaneous">Miscellaneous</option>
                <option value="travel">Travel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To Date</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>

        {/* Expense list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">All Expenses</h2>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{hasFilters ? "No expenses match your filters." : "No expenses recorded yet."}</p>
              {!hasFilters && (
                <button onClick={() => setShowModal(true)} className="text-orange-500 text-sm hover:underline mt-1">
                  Add your first expense →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {expenses.map((exp) => (
                <div key={exp._id} className="flex items-center gap-3 px-4 lg:px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 w-24 text-center ${TYPE_COLORS[exp.type] || "bg-slate-100 text-slate-600"}`}>
                    {exp.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{exp.description}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {(exp.project as { name?: string })?.name ?? "—"}
                      {exp.vendor ? ` · ${exp.vendor}` : ""}
                      {exp.paymentMode ? ` · ${exp.paymentMode}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-rose-600">{formatINR(exp.amount)}</p>
                    <p className="text-xs text-slate-400">{new Date(exp.date).toLocaleDateString("en-IN")}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(exp._id)}
                    className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 ml-1"
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
