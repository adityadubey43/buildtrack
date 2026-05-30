"use client";

import { useState } from "react";
import { UserPlus, Search, Shield, MoreVertical } from "lucide-react";

const TEAM = [
  { id: 1, name: "Rajesh Patel", email: "rajesh@patel.com", role: "admin", site: "All Sites", joined: "01 Jan 2026", status: "active" },
  { id: 2, name: "Amit Shah", email: "amit@patel.com", role: "engineer", site: "Skyline Heights", joined: "15 Jan 2026", status: "active" },
  { id: 3, name: "Priya Sharma", email: "priya@patel.com", role: "supervisor", site: "Green Valley", joined: "01 Feb 2026", status: "active" },
  { id: 4, name: "Sunita Reddy", email: "sunita@patel.com", role: "accountant", site: "All Sites", joined: "10 Jan 2026", status: "active" },
  { id: 5, name: "Kiran Mehta", email: "kiran@patel.com", role: "partner", site: "Metro Plaza", joined: "20 Mar 2026", status: "active" },
  { id: 6, name: "Deepak Joshi", email: "deepak@patel.com", role: "supervisor", site: "River View", joined: "01 Apr 2026", status: "inactive" },
];

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  partner: "bg-purple-100 text-purple-700",
  engineer: "bg-blue-100 text-blue-700",
  supervisor: "bg-orange-100 text-orange-700",
  accountant: "bg-green-100 text-green-700",
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["Full access to all modules", "Manage roles & permissions", "View all financial data", "Create/delete projects"],
  partner: ["View all projects", "View financial reports", "Cannot modify worker data"],
  engineer: ["Submit DPR", "View assigned projects", "Manage attendance at site"],
  supervisor: ["Mark attendance", "Submit DPR", "View workers at assigned site"],
  accountant: ["View & export payroll", "Manage invoices & billing", "View budget data"],
};

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<(typeof TEAM)[0] | null>(null);

  const filtered = TEAM.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team & Access Control</h1>
          <p className="text-slate-500 text-sm">{TEAM.length} members across all roles</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Role overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {Object.entries(ROLE_STYLE).map(([role, style]) => {
          const count = TEAM.filter((m) => m.role === role).length;
          return (
            <div key={role} className={`rounded-xl p-3 text-center ${style}`}>
              <div className="text-xl font-black">{count}</div>
              <div className="text-xs font-semibold capitalize">{role}</div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search team members..."
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
                {["Member", "Email", "Role", "Assigned Site", "Joined", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-xs">
                        {m.name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-900 text-sm">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${ROLE_STYLE[m.role]}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{m.site}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.joined}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${m.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedMember(m)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions reference */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-slate-900">Role Permissions Reference</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
            <div key={role} className="bg-slate-50 rounded-xl p-4">
              <div className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize w-fit mb-3 ${ROLE_STYLE[role]}`}>
                {role}
              </div>
              <ul className="space-y-1">
                {perms.map((p) => (
                  <li key={p} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Invite Team Member</h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input type="text" placeholder="John Smith" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input type="email" placeholder="john@company.com" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700">
                  <option>Select role</option>
                  <option>partner</option>
                  <option>engineer</option>
                  <option>supervisor</option>
                  <option>accountant</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Site</label>
                <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700">
                  <option>All Sites</option>
                  <option>Skyline Heights</option>
                  <option>Green Valley Villas</option>
                  <option>Metro Plaza</option>
                  <option>River View Apartments</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium">Cancel</button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">Send Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
