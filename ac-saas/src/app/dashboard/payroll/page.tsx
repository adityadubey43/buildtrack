"use client";

import { useState } from "react";
import { Calculator, Download, CheckCircle, Clock, AlertCircle, Users, DollarSign, TrendingUp } from "lucide-react";

const PAYROLL_DATA = [
  { id: 1, name: "Ramesh Kumar", role: "Mason", site: "Skyline Heights", days: 26, wage: 700, overtime: 3, total: 18700, status: "paid", paidOn: "27 May 2026" },
  { id: 2, name: "Suresh Patel", role: "Labour", site: "Green Valley", days: 24, wage: 500, overtime: 0, total: 12000, status: "pending", paidOn: "-" },
  { id: 3, name: "Mohd. Iqbal", role: "Supervisor", site: "Metro Plaza", days: 25, wage: 1200, overtime: 5, total: 31500, status: "paid", paidOn: "27 May 2026" },
  { id: 4, name: "Vijay Sharma", role: "Labour", site: "River View", days: 22, wage: 500, overtime: 2, total: 11300, status: "pending", paidOn: "-" },
  { id: 5, name: "Deepak Yadav", role: "Contractor", site: "Skyline Heights", days: 0, wage: 0, overtime: 0, total: 85000, status: "paid", paidOn: "20 May 2026" },
  { id: 6, name: "Anita Bai", role: "Labour", site: "Green Valley", days: 23, wage: 450, overtime: 0, total: 10350, status: "pending", paidOn: "-" },
];

export default function PayrollPage() {
  const [week, setWeek] = useState("Week 21 (20-26 May 2026)");

  const totalPaid = PAYROLL_DATA.filter((r) => r.status === "paid").reduce((s, r) => s + r.total, 0);
  const totalPending = PAYROLL_DATA.filter((r) => r.status === "pending").reduce((s, r) => s + r.total, 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
          <p className="text-slate-500 text-sm">Auto-calculated from attendance data</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
            <Calculator className="w-4 h-4" />
            Run Payroll
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Workers", value: PAYROLL_DATA.length, icon: Users, bg: "bg-blue-50", color: "text-blue-600" },
          { label: "Total Payable", value: `₹${((totalPaid + totalPending) / 100000).toFixed(1)}L`, icon: DollarSign, bg: "bg-orange-50", color: "text-orange-600" },
          { label: "Amount Paid", value: `₹${(totalPaid / 100000).toFixed(1)}L`, icon: CheckCircle, bg: "bg-green-50", color: "text-green-600" },
          { label: "Pending", value: `₹${(totalPending / 100000).toFixed(1)}L`, icon: Clock, bg: "bg-red-50", color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="text-xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-3 mb-5">
        <select
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option>Week 21 (20-26 May 2026)</option>
          <option>Week 20 (13-19 May 2026)</option>
          <option>Week 19 (6-12 May 2026)</option>
        </select>
        <span className="text-sm text-slate-500">Showing payroll for selected period</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Worker</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Site</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Days</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rate/Day</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Overtime</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {PAYROLL_DATA.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-xs">
                        {row.name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-900 text-sm">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.role}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.site}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right font-medium">
                    {row.days > 0 ? row.days : "Contract"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">
                    {row.wage > 0 ? `₹${row.wage}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.overtime}h</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-slate-900 text-sm">₹{row.total.toLocaleString("en-IN")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      row.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {row.status === "paid" ? "Paid" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.status === "pending" ? (
                      <button className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg font-medium">
                        Pay Now
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">{row.paidOn}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td colSpan={6} className="px-4 py-3 font-bold text-slate-800 text-sm">Total</td>
                <td className="px-4 py-3 text-right font-black text-slate-900">
                  ₹{PAYROLL_DATA.reduce((s, r) => s + r.total, 0).toLocaleString("en-IN")}
                </td>
                <td colSpan={2} className="px-4 py-3">
                  <button className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium">
                    Pay All Pending
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
