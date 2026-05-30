"use client";

import { useState } from "react";
import { Package, AlertTriangle, Plus, Search, TrendingDown } from "lucide-react";

const MATERIALS = [
  { id: 1, name: "Cement (OPC 53)", unit: "Bags", stock: 420, min: 200, ordered: 500, vendor: "UltraTech Cement", site: "Skyline Heights", status: "ok" },
  { id: 2, name: "TMT Steel Bars", unit: "MT", stock: 8.5, min: 10, ordered: 0, vendor: "JSW Steel", site: "Green Valley", status: "low" },
  { id: 3, name: "River Sand", unit: "Brass", stock: 35, min: 20, ordered: 0, vendor: "Local Vendor", site: "Metro Plaza", status: "ok" },
  { id: 4, name: "Bricks (Red)", unit: "Units", stock: 12000, min: 5000, ordered: 20000, vendor: "Patel Brick Works", site: "River View", status: "ok" },
  { id: 5, name: "Ready Mix Concrete", unit: "m³", stock: 0, min: 50, ordered: 100, vendor: "ACC RMC", site: "Skyline Heights", status: "critical" },
  { id: 6, name: "Plumbing Pipes (PVC)", unit: "Pieces", stock: 340, min: 100, ordered: 0, vendor: "Supreme Industries", site: "Metro Plaza", status: "ok" },
];

const STATUS_MAP: Record<string, string> = {
  ok: "bg-green-100 text-green-700",
  low: "bg-yellow-100 text-yellow-700",
  critical: "bg-red-100 text-red-700",
};

export default function MaterialsPage() {
  const [search, setSearch] = useState("");
  const filtered = MATERIALS.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Material Management</h1>
          <p className="text-slate-500 text-sm">Track inventory across all sites</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Request Material
        </button>
      </div>

      {/* Alerts */}
      <div className="space-y-2 mb-6">
        {MATERIALS.filter((m) => m.status !== "ok").map((m) => (
          <div
            key={m.id}
            className={`flex items-center justify-between p-3 rounded-xl text-sm border ${
              m.status === "critical" ? "bg-red-50 border-red-200 text-red-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {m.status === "critical" ? `CRITICAL: ${m.name} is out of stock at ${m.site}` : `LOW STOCK: ${m.name} at ${m.site} — only ${m.stock} ${m.unit} left`}
            </div>
            <button className="text-xs font-semibold underline">Order Now</button>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search materials..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Material", "Unit", "In Stock", "Min. Required", "On Order", "Vendor", "Site", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900 text-sm">{m.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.unit}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 text-sm">{m.stock}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.min}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{m.ordered > 0 ? m.ordered : "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{m.vendor}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{m.site}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_MAP[m.status]}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-orange-500 hover:underline">Order</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
