"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  api,
  type Project, type Expense, type PaymentReceived,
  type Invoice, type DPR, type AttendanceRecord,
} from "@/lib/api";
import { getUser } from "@/lib/store";
import { canSeeFinance } from "@/lib/permissions";
import {
  ArrowLeft, MapPin, Calendar, Building2, AlertTriangle, TrendingUp, TrendingDown,
  Wallet, DollarSign, Receipt, FileText, Camera, Layers, Users,
} from "lucide-react";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const TYPE_COLORS: Record<string, string> = {
  labour: "bg-blue-100 text-blue-700",
  material: "bg-orange-100 text-orange-700",
  miscellaneous: "bg-purple-100 text-purple-700",
  travel: "bg-green-100 text-green-700",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  planning: "bg-blue-100 text-blue-700",
  "on-hold": "bg-yellow-100 text-yellow-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  sent: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  "partially-paid": "bg-yellow-100 text-yellow-700",
  draft: "bg-slate-100 text-slate-600",
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-yellow-100 text-yellow-700",
  "half-day": "bg-orange-100 text-orange-700",
};

type TabId = "overview" | "expenses" | "payments" | "bills" | "dpr" | "attendance";

const FINANCE_TABS: TabId[] = ["expenses", "payments", "bills"];

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "expenses", label: "Expenses", icon: DollarSign },
  { id: "payments", label: "Payments Received", icon: Wallet },
  { id: "bills", label: "Bills Raised", icon: Receipt },
  { id: "dpr", label: "DPR", icon: FileText },
  { id: "attendance", label: "Attendance", icon: Camera },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<PaymentReceived[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dprs, setDprs] = useState<DPR[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("overview");
  const [showFinance, setShowFinance] = useState(false);

  useEffect(() => { setShowFinance(canSeeFinance(getUser()?.role)); }, []);
  // If a finance tab somehow becomes active without permission, fall back to overview
  useEffect(() => {
    if (!showFinance && FINANCE_TABS.includes(tab)) setTab("overview");
  }, [showFinance, tab]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const p = { project: id } as Record<string, string>;
      const [projRes, expRes, payRes, invRes, dprRes, attRes] = await Promise.all([
        api.projects.get(id),
        api.expenses.list(p).catch(() => ({ data: [] as Expense[] })),
        api.payments.list(p).catch(() => ({ data: [] as PaymentReceived[] })),
        api.invoices.list(p).catch(() => ({ data: [] as Invoice[] })),
        api.dpr.list(p).catch(() => ({ data: [] as DPR[] })),
        api.attendance.list(p).catch(() => ({ data: [] as AttendanceRecord[] })),
      ]);
      setProject(projRes.data);
      setExpenses(expRes.data);
      setPayments(payRes.data);
      setInvoices(invRes.data);
      setDprs(dprRes.data);
      setAttendance(attRes.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load project.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">{error || "Project not found."}</p>
          <Link href="/dashboard/projects" className="mt-3 inline-block text-sm text-orange-500 underline">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const totalBilled = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const profit = totalPayments - totalExpenses;
  const isProfit = profit >= 0;
  const spentPct = project.budget > 0 ? Math.min(100, (totalExpenses / project.budget) * 100) : 0;

  // Expense breakdown by type
  const expenseByType = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + e.amount;
    return acc;
  }, {});

  const COUNTS: Record<TabId, number> = {
    overview: 0,
    expenses: expenses.length,
    payments: payments.length,
    bills: invoices.length,
    dpr: dprs.length,
    attendance: attendance.length,
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-500 mb-3">
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_BADGE[project.status] || "bg-slate-100 text-slate-600"}`}>
                {project.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mt-1">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{project.location}</span>
              {project.clientName && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{project.clientName}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fmtDate(project.startDate)} – {fmtDate(project.endDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial summary cards — finance roles only */}
      {showFinance && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Budget", value: formatINR(project.budget), icon: Building2, color: "text-slate-700", bg: "bg-slate-50" },
            { label: "Total Expenses", value: formatINR(totalExpenses), icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "Payments Received", value: formatINR(totalPayments), icon: Wallet, color: "text-green-600", bg: "bg-green-50" },
            { label: "Bills Raised", value: formatINR(totalBilled), icon: Receipt, color: "text-blue-600", bg: "bg-blue-50" },
            { label: isProfit ? "Profit" : "Loss", value: formatINR(Math.abs(profit)), icon: isProfit ? TrendingUp : TrendingDown, color: isProfit ? "text-emerald-600" : "text-red-600", bg: isProfit ? "bg-emerald-50" : "bg-red-50" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center mb-2`}>
                <c.icon className={`w-4.5 h-4.5 ${c.color}`} />
              </div>
              <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
              <div className="text-slate-500 text-xs">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
          {TABS.filter((t) => showFinance || !FINANCE_TABS.includes(t.id)).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {COUNTS[t.id] > 0 && (
                <span className={`text-xs px-1.5 rounded-full ${tab === t.id ? "bg-white/20" : "bg-slate-100"}`}>
                  {COUNTS[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-6">
              {/* Progress + budget */}
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm mb-3">Overall Progress</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${project.overallProgress}%` }} />
                    </div>
                    <span className="text-lg font-bold text-slate-900">{project.overallProgress}%</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Current phase: <span className="font-medium text-slate-700">{project.currentPhase}</span></p>
                </div>
                {showFinance && (
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm mb-3">Budget Utilisation</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${spentPct > 90 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${spentPct}%` }} />
                      </div>
                      <span className="text-lg font-bold text-slate-900">{spentPct.toFixed(0)}%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{formatINR(totalExpenses)} spent of {formatINR(project.budget)}</p>
                  </div>
                )}
              </div>

              {/* Phases */}
              {project.phases && project.phases.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm mb-3">Phases</h3>
                  <div className="space-y-2">
                    {project.phases.map((ph) => (
                      <div key={ph._id} className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 w-28 flex-shrink-0 truncate">{ph.name}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ph.completionPct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-600 w-9 text-right">{ph.completionPct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense breakdown by type — finance roles only */}
              {showFinance && Object.keys(expenseByType).length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm mb-3">Expense Breakdown</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(expenseByType).map(([type, amt]) => (
                      <div key={type} className="bg-slate-50 rounded-xl p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[type] || "bg-slate-100 text-slate-600"}`}>{type}</span>
                        <div className="text-sm font-bold text-slate-800 mt-1.5">{formatINR(amt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXPENSES */}
          {tab === "expenses" && (
            <SectionList
              empty="No expenses recorded for this project."
              rows={expenses.map((e) => ({
                key: e._id,
                badge: { text: e.type, cls: TYPE_COLORS[e.type] || "bg-slate-100 text-slate-600" },
                title: e.description,
                sub: `${e.vendor ? e.vendor + " · " : ""}${e.paymentMode}`,
                amount: formatINR(e.amount),
                amountCls: "text-rose-600",
                date: fmtDate(e.date),
              }))}
            />
          )}

          {/* PAYMENTS */}
          {tab === "payments" && (
            <SectionList
              empty="No payments received for this project."
              rows={payments.map((p) => ({
                key: p._id,
                badge: { text: p.paymentMode, cls: "bg-green-100 text-green-700" },
                title: p.clientName,
                sub: `${p.milestone ? p.milestone + " · " : ""}${p.reference || ""}`,
                amount: formatINR(p.amount),
                amountCls: "text-green-600",
                date: fmtDate(p.date),
              }))}
            />
          )}

          {/* BILLS / INVOICES */}
          {tab === "bills" && (
            <SectionList
              empty="No bills raised for this project."
              rows={invoices.map((inv) => ({
                key: inv._id,
                badge: { text: inv.status, cls: STATUS_BADGE[inv.status] || "bg-slate-100 text-slate-600" },
                title: `${inv.invoiceNumber} · ${inv.clientName}`,
                sub: `${inv.milestone ? inv.milestone + " · " : ""}Due ${fmtDate(inv.dueDate)} · Bal ${formatINR(inv.balanceAmount)}`,
                amount: formatINR(inv.totalAmount),
                amountCls: "text-blue-600",
                date: fmtDate(inv.invoiceDate),
              }))}
            />
          )}

          {/* DPR */}
          {tab === "dpr" && (
            <div>
              {dprs.length === 0 ? (
                <EmptyState text="No daily progress reports for this project." />
              ) : (
                <div className="space-y-3">
                  {dprs.map((dpr) => (
                    <div key={dpr._id} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{dpr.workActivity}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {fmtDate(dpr.date)} · {dpr.submittedBy?.name || "—"} · {dpr.workersPresent} workers · {dpr.weather}
                          </p>
                        </div>
                        {dpr.hasDelay && (
                          <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                            ⚠ Delay
                          </span>
                        )}
                      </div>
                      {dpr.workDescription && <p className="text-xs text-slate-500 mb-2">{dpr.workDescription}</p>}
                      {dpr.images && dpr.images.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {dpr.images.map((img, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={img.url} alt={`Site ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ATTENDANCE */}
          {tab === "attendance" && (
            <div>
              {attendance.length === 0 ? (
                <EmptyState text="No attendance records for this project." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                        <th className="py-2 pr-3 font-medium">Worker</th>
                        <th className="py-2 pr-3 font-medium">Role</th>
                        <th className="py-2 pr-3 font-medium">Date</th>
                        <th className="py-2 pr-3 font-medium">In</th>
                        <th className="py-2 pr-3 font-medium">OT</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((a) => (
                        <tr key={a._id} className="border-b border-slate-50">
                          <td className="py-2.5 pr-3 font-medium text-slate-800">{a.worker?.name || "—"}</td>
                          <td className="py-2.5 pr-3 text-slate-500 capitalize">{a.worker?.role || "—"}</td>
                          <td className="py-2.5 pr-3 text-slate-500">{fmtDate(a.date)}</td>
                          <td className="py-2.5 pr-3 text-slate-500">{a.timeIn || "—"}</td>
                          <td className="py-2.5 pr-3 text-slate-500">{a.overtimeHours ? `${a.overtimeHours}h` : "—"}</td>
                          <td className="py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[a.status] || "bg-slate-100 text-slate-600"}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-slate-400">
      <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

type Row = {
  key: string;
  badge: { text: string; cls: string };
  title: string;
  sub: string;
  amount: string;
  amountCls: string;
  date: string;
};

function SectionList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  return (
    <div className="divide-y divide-slate-50">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 w-24 text-center ${r.badge.cls}`}>
            {r.badge.text}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
            {r.sub.trim() && <p className="text-xs text-slate-400 truncate">{r.sub}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-bold ${r.amountCls}`}>{r.amount}</p>
            <p className="text-xs text-slate-400">{r.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
