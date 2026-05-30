"use client";

import { BarChart3, TrendingUp, TrendingDown, Users, DollarSign, Clock } from "lucide-react";

const MONTHLY_REVENUE = [
  { month: "Jan", revenue: 12.4, target: 15 },
  { month: "Feb", revenue: 18.2, target: 15 },
  { month: "Mar", revenue: 14.8, target: 16 },
  { month: "Apr", revenue: 22.1, target: 18 },
  { month: "May", revenue: 18.4, target: 20 },
];

const PROJECT_PERFORMANCE = [
  { name: "Skyline Heights", progress: 72, budget: 2.4, spent: 1.72, productivity: 88 },
  { name: "Green Valley", progress: 45, budget: 1.8, spent: 0.9, productivity: 65 },
  { name: "Metro Plaza", progress: 88, budget: 3.1, spent: 2.8, productivity: 72 },
  { name: "River View", progress: 18, budget: 4.2, spent: 0.7, productivity: 91 },
];

const maxRev = Math.max(...MONTHLY_REVENUE.map((m) => Math.max(m.revenue, m.target)));

export default function AnalyticsPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
        <p className="text-slate-500 text-sm">Performance insights for May 2026</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Monthly Revenue", value: "₹18.4L", change: "+8% vs last month", positive: true, icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
          { label: "Labour Productivity", value: "79%", change: "-3% vs last month", positive: false, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Avg Project Delay", value: "4.2 days", change: "-1.1 days improved", positive: true, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Cost Overrun Risk", value: "1 project", change: "Metro Plaza at 90%", positive: false, icon: TrendingUp, color: "text-red-600", bg: "bg-red-50" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-10 h-10 ${kpi.bg} rounded-xl flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <div className="text-xl font-bold text-slate-900">{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
            <div className={`text-xs mt-1 font-medium flex items-center gap-1 ${kpi.positive ? "text-green-600" : "text-red-500"}`}>
              {kpi.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {kpi.change}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart (CSS-based bar chart) */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-5">Monthly Revenue vs Target (₹ Lakhs)</h2>
        <div className="flex items-end gap-4 h-48">
          {MONTHLY_REVENUE.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-1 justify-center" style={{ height: "160px" }}>
                <div
                  className="flex-1 bg-orange-500 rounded-t-lg transition-all"
                  style={{ height: `${(m.revenue / maxRev) * 160}px` }}
                  title={`Revenue: ₹${m.revenue}L`}
                />
                <div
                  className="flex-1 bg-slate-200 rounded-t-lg"
                  style={{ height: `${(m.target / maxRev) * 160}px` }}
                  title={`Target: ₹${m.target}L`}
                />
              </div>
              <div className="text-xs text-slate-500">{m.month}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="w-3 h-3 bg-orange-500 rounded-sm" />
            Revenue
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="w-3 h-3 bg-slate-200 rounded-sm" />
            Target
          </div>
        </div>
      </div>

      {/* Project performance table */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-4">Project Performance Summary</h2>
        <div className="space-y-4">
          {PROJECT_PERFORMANCE.map((p) => (
            <div key={p.name} className="grid grid-cols-4 gap-4 items-center py-3 border-b border-slate-50 last:border-0">
              <div className="font-semibold text-slate-800 text-sm">{p.name}</div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Progress</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{p.progress}%</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Budget Used</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(p.spent / p.budget) > 0.9 ? "bg-red-500" : "bg-green-500"}`}
                      style={{ width: `${(p.spent / p.budget) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{((p.spent / p.budget) * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Labour Productivity</div>
                <span className={`text-xs font-bold ${p.productivity >= 80 ? "text-green-600" : p.productivity >= 70 ? "text-yellow-600" : "text-red-500"}`}>
                  {p.productivity}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-900 mb-2">Export Reports</h3>
        <p className="text-slate-500 text-sm mb-4">Download detailed reports in PDF or Excel format</p>
        <div className="flex flex-wrap gap-3">
          {["Labour Productivity Report", "Cost Analysis Report", "Delay Analysis", "Profitability Report", "Monthly Summary"].map((r) => (
            <button key={r} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-orange-200 rounded-lg text-sm text-slate-700 hover:bg-orange-50 transition-colors">
              <BarChart3 className="w-3.5 h-3.5 text-orange-500" />
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
