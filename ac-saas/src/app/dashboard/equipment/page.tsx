"use client";

import { Wrench, Plus, AlertTriangle } from "lucide-react";

const EQUIPMENT = [
  { id: 1, name: "JCB Excavator", type: "Heavy Machinery", site: "River View", status: "active", hours: 124, nextMaint: "10 Jun 2026", owner: "Owned" },
  { id: 2, name: "Concrete Mixer (Large)", type: "Mixing Equipment", site: "Skyline Heights", status: "active", hours: 89, nextMaint: "15 Jun 2026", owner: "Owned" },
  { id: 3, name: "Tower Crane #1", type: "Lifting Equipment", site: "Skyline Heights", status: "maintenance", hours: 312, nextMaint: "Today", owner: "Rented" },
  { id: 4, name: "Vibrator Set (6 units)", type: "Compaction", site: "Metro Plaza", status: "active", hours: 45, nextMaint: "30 Jun 2026", owner: "Owned" },
  { id: 5, name: "Bar Bending Machine", type: "Fabrication", site: "Green Valley", status: "idle", hours: 67, nextMaint: "20 Jun 2026", owner: "Owned" },
];

const STATUS_MAP: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  maintenance: "bg-red-100 text-red-700",
  idle: "bg-slate-100 text-slate-600",
};

export default function EquipmentPage() {
  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equipment Management</h1>
          <p className="text-slate-500 text-sm">Track machinery across all sites</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Add Equipment
        </button>
      </div>

      {/* Maintenance alert */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 flex items-center gap-2 text-sm text-red-700">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Tower Crane #1 at Skyline Heights is due for maintenance TODAY
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-green-700">{EQUIPMENT.filter((e) => e.status === "active").length}</div>
          <div className="text-xs text-green-600 font-medium">Active</div>
        </div>
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-slate-600">{EQUIPMENT.filter((e) => e.status === "idle").length}</div>
          <div className="text-xs text-slate-500 font-medium">Idle</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-red-600">{EQUIPMENT.filter((e) => e.status === "maintenance").length}</div>
          <div className="text-xs text-red-500 font-medium">In Maintenance</div>
        </div>
      </div>

      {/* Equipment cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EQUIPMENT.map((eq) => (
          <div key={eq.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <Wrench className="w-5 h-5 text-orange-600" />
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_MAP[eq.status]}`}>
                {eq.status}
              </span>
            </div>
            <h3 className="font-bold text-slate-900 mb-0.5">{eq.name}</h3>
            <p className="text-xs text-slate-500 mb-3">{eq.type} · {eq.owner}</p>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Deployed at</span>
                <span className="font-medium text-slate-800">{eq.site}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Hours logged</span>
                <span className="font-medium text-slate-800">{eq.hours} hrs</span>
              </div>
              <div className={`flex justify-between ${eq.nextMaint === "Today" ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                <span>Next maintenance</span>
                <span>{eq.nextMaint}</span>
              </div>
            </div>

            <button className="mt-4 w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              Log Usage / Maintenance
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
