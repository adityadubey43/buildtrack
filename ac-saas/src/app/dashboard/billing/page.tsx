"use client";

import { useState } from "react";
import { Receipt, Plus, Download, CheckCircle, Clock, AlertCircle } from "lucide-react";

const INVOICES = [
  { id: "INV-089", client: "Patel Group", project: "Skyline Heights", milestone: "Slab Level 3 Complete", amount: 1200000, gst: 216000, total: 1416000, date: "28 May 2026", due: "12 Jun 2026", status: "sent" },
  { id: "INV-088", client: "Mehta Builders", project: "Green Valley Villas", milestone: "Foundation Work", amount: 800000, gst: 144000, total: 944000, date: "20 May 2026", due: "04 Jun 2026", status: "paid" },
  { id: "INV-087", client: "Gupta Infra Ltd", project: "Metro Plaza", milestone: "Plastering – Wing A", amount: 450000, gst: 81000, total: 531000, date: "10 May 2026", due: "25 May 2026", status: "overdue" },
  { id: "INV-086", client: "Shah Developers", project: "River View Apartments", milestone: "Mobilization Advance", amount: 2000000, gst: 360000, total: 2360000, date: "01 Apr 2026", due: "15 Apr 2026", status: "paid" },
];

const STATUS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700", icon: Clock },
  paid: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function BillingPage() {
  const [showModal, setShowModal] = useState(false);

  const totalRevenue = INVOICES.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalPending = INVOICES.filter((i) => i.status !== "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing & Invoicing</h1>
          <p className="text-slate-500 text-sm">GST-ready invoice management</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <div className="text-xs text-green-600 font-medium mb-1">Revenue Collected</div>
          <div className="text-xl font-black text-green-700">{fmt(totalRevenue)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="text-xs text-blue-600 font-medium mb-1">Pending Invoices</div>
          <div className="text-xl font-black text-blue-700">{fmt(totalPending)}</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <div className="text-xs text-red-500 font-medium mb-1">Overdue Amount</div>
          <div className="text-xl font-black text-red-600">
            {fmt(INVOICES.filter((i) => i.status === "overdue").reduce((s, i) => s + i.total, 0))}
          </div>
        </div>
      </div>

      {/* Invoices table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Invoice #", "Client", "Project", "Milestone", "Amount", "GST (18%)", "Total", "Due Date", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {INVOICES.map((inv) => {
                const sc = STATUS[inv.status];
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-sm font-bold text-slate-900">{inv.id}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{inv.client}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inv.project}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inv.milestone}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmt(inv.amount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmt(inv.gst)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 text-sm">{fmt(inv.total)}</td>
                    <td className={`px-4 py-3 text-sm ${inv.status === "overdue" ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                      {inv.due}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 w-fit ${sc.color}`}>
                        <sc.icon className="w-3 h-3" />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="text-xs text-slate-500 hover:text-orange-500">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {inv.status !== "paid" && (
                          <button className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg">Mark Paid</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Create GST Invoice</h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: "Client Name", placeholder: "Patel Group" },
                { label: "Project", placeholder: "Skyline Heights" },
                { label: "Milestone / Work Description", placeholder: "RCC Slab Level 3 Completion" },
                { label: "Amount (₹)", placeholder: "12,00,000" },
                { label: "Payment Due Date", placeholder: "DD/MM/YYYY" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
              <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                GST @ 18% will be added automatically. Invoice will be GST-compliant.
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium">Cancel</button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">Generate Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
