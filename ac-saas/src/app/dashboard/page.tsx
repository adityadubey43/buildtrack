"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, type DashboardStats } from "@/lib/api";
import { getUser } from "@/lib/store";
import { canAccess, canSeeFinance } from "@/lib/permissions";
import { MyAttendanceCard } from "@/components/selfAttendance";
import {
  Building2, Users, AlertTriangle, Plus, MapPin,
  FileText, Package, Bell, Camera, TrendingUp, TrendingDown,
  DollarSign, Wallet,
} from "lucide-react";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string>("");

  useEffect(() => { setRole(getUser()?.role || ""); }, []);

  const loadData = useCallback(async () => {
    try {
      const statsRes = await api.dashboard.stats();
      setStats(statsRes.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-red-500 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const profit = stats?.profit ?? 0;
  const isProfit = profit >= 0;
  const showFinance = canSeeFinance(role);

  const STAT_CARDS = stats ? (
    showFinance
      ? [
          { label: "Total Expenses", value: formatINR(stats.totalExpenses ?? 0), icon: DollarSign, color: "text-rose-600", bg: "bg-rose-50" },
          { label: "Payments Received", value: formatINR(stats.totalPaymentsReceived ?? 0), icon: Wallet, color: "text-green-600", bg: "bg-green-50" },
          { label: isProfit ? "Profit" : "Loss", value: formatINR(Math.abs(profit)), icon: isProfit ? TrendingUp : TrendingDown, color: isProfit ? "text-green-600" : "text-red-600", bg: isProfit ? "bg-green-50" : "bg-red-50" },
          { label: "Active Projects", value: String(stats.activeProjects), icon: Building2, color: "text-orange-600", bg: "bg-orange-50" },
        ]
      : [
          // Non-finance roles: operational stats only
          { label: "Active Projects", value: String(stats.activeProjects), icon: Building2, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Total Workers", value: String(stats.totalWorkers), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Present Today", value: String(stats.todayPresent), icon: Camera, color: "text-green-600", bg: "bg-green-50" },
          { label: "DPRs Missing", value: String(stats.missingDPRsToday), icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
        ]
  ) : [];

  const ALERTS = stats ? [
    ...(stats.missingDPRsToday > 0 ? [{ type: "warning", text: `${stats.missingDPRsToday} project(s) haven't submitted DPR today` }] : []),
    ...(stats.lowStockAlerts > 0 ? [{ type: "info", text: `${stats.lowStockAlerts} material(s) are below minimum stock level` }] : []),
  ] : [];

  const projectFinancials = stats?.projectFinancials ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">{today}</p>
        </div>
        {canAccess(role, "/dashboard/projects") && (
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-orange-500/30"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        )}
      </div>

      {/* Alerts */}
      {ALERTS.length > 0 && (
        <div className="space-y-2">
          {ALERTS.map((alert, i) => (
            <div key={i} className={`flex items-center p-3 rounded-xl border text-sm ${
              alert.type === "warning"
                ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mr-2" />
              {alert.text}
            </div>
          ))}
        </div>
      )}

      {/* Stats Row — Expenses / Received / P&L / Projects */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main grid: Projects Overview (left) + widgets stacked (right) */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">

        {/* Projects Overview — left, 4 visible then scroll */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900">Projects Overview</h2>
              <p className="text-slate-400 text-xs mt-0.5">Site-wise expenses, payments & profit/loss</p>
            </div>
            <Link href="/dashboard/projects" className="text-orange-500 text-sm hover:underline">View all</Link>
          </div>

          {projectFinancials.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No active projects yet.</p>
              <Link href="/dashboard/projects" className="text-orange-500 text-sm hover:underline mt-1 inline-block">
                Create your first project →
              </Link>
            </div>
          ) : (
            // 4 cards visible (each ≈ 10.5rem), rest scrollable
            <div className="divide-y divide-slate-50 max-h-[42rem] overflow-y-auto">
              {projectFinancials.map((pf) => {
                const pl = pf.profit;
                const plPositive = pl >= 0;
                return (
                  <div key={String(pf.projectId)} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{pf.projectName}</p>
                        <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{pf.location}</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${
                        pf.status === "active" ? "bg-green-100 text-green-700" :
                        pf.status === "on-hold" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {pf.status}
                      </span>
                    </div>

                    {/* Financial pills — finance roles only */}
                    {showFinance && (
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">
                          Exp: {formatINR(pf.totalExpenses)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                          Recv: {formatINR(pf.totalPayments)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                          {plPositive ? "Profit" : "Loss"}: {formatINR(Math.abs(pl))}
                        </span>
                      </div>
                    )}

                    {/* Progress */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pf.overallProgress}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0 w-9 text-right">{pf.overallProgress}%</span>
                    </div>

                    <Link
                      href={`/dashboard/projects/${pf.projectId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      View Details →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Recent DPRs · Quick Actions · Today's Attendance */}
        <div className="space-y-6">

        {/* Recent DPRs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Recent DPRs</h3>
            <Link href="/dashboard/reports" className="text-orange-500 text-xs hover:underline">View all</Link>
          </div>
          {stats?.recentDPRs && stats.recentDPRs.length > 0 ? (
            <div className="space-y-3">
              {stats.recentDPRs.slice(0, 5).map((dpr) => (
                <div key={dpr._id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-700 font-medium truncate">{dpr.project?.name || "Project"}</p>
                    <p className="text-xs text-slate-400 truncate">{dpr.workActivity}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(dpr.date).toLocaleDateString("en-IN")} · {dpr.submittedBy?.name || "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No DPRs submitted yet.</p>
              <Link href="/dashboard/reports" className="text-orange-500 text-xs hover:underline mt-1 inline-block">
                Submit a DPR →
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: TrendingDown, label: "Add Expense", color: "bg-rose-50 text-rose-600", href: "/dashboard/expenses" },
              { icon: Wallet, label: "Add Payment", color: "bg-green-50 text-green-600", href: "/dashboard/payments" },
              { icon: Camera, label: "Attendance", color: "bg-blue-50 text-blue-600", href: "/dashboard/attendance/labour" },
              { icon: FileText, label: "Submit DPR", color: "bg-orange-50 text-orange-600", href: "/dashboard/reports" },
              { icon: Package, label: "Materials", color: "bg-purple-50 text-purple-600", href: "/dashboard/materials" },
              { icon: Bell, label: "Billing", color: "bg-indigo-50 text-indigo-600", href: "/dashboard/billing" },
            ].filter((action) => canAccess(role, action.href)).map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl ${action.color} hover:opacity-80 transition-opacity text-xs font-medium text-center`}
              >
                <action.icon className="w-5 h-5" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        {/* My own check-in / check-out */}
        <MyAttendanceCard />

        {/* Attendance Widget */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Today&apos;s Attendance</h3>
            <span className="text-slate-400 text-xs">Live</span>
          </div>
          <div className="text-3xl font-black mb-1">
            {stats?.todayPresent || 0}{" "}
            <span className="text-lg font-normal text-slate-400">/ {stats?.totalWorkers || 0}</span>
          </div>
          <p className="text-slate-400 text-xs mb-4">Workers present across all sites</p>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${stats?.attendanceRate || 0}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-orange-400 text-xs">{stats?.attendanceRate || 0}% attendance rate</p>
            <Link href="/dashboard/attendance/labour" className="text-slate-400 text-xs hover:text-white transition-colors">
              <Users className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
