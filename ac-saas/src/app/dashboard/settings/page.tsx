"use client";

import { useState, useEffect } from "react";
import { Building2, CreditCard, Bell, Shield, Save } from "lucide-react";
import { getUser, type User } from "@/lib/store";

const TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "billing", label: "Subscription", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

const PLANS = [
  { id: "basic", name: "Basic", price: "₹999/mo", features: "3 projects, 25 workers" },
  { id: "pro", name: "Pro", price: "₹2,499/mo", features: "Unlimited projects & workers" },
  { id: "enterprise", name: "Enterprise", price: "Custom", features: "All features + dedicated support" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("company");
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setUser(getUser());
    setOrigin(window.location.origin);
  }, []);

  const loginUrl = user?.slug ? `${origin}/c/${user.slug}` : "";
  const copyLink = () => {
    if (!loginUrl) return;
    navigator.clipboard.writeText(loginUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your company account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="lg:w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-orange-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {activeTab === "company" && (
            <div className="space-y-5">
              <h2 className="font-bold text-slate-900 text-lg">Company Information</h2>

              {/* Per-company login link to share with employees */}
              {user?.slug && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="text-sm font-semibold text-slate-800 mb-1">Your Company Login Link</div>
                  <p className="text-xs text-slate-500 mb-3">Share this with your employees — they sign in to your company here.</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={loginUrl}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 font-mono"
                    />
                    <button
                      onClick={copyLink}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold ${copied ? "bg-green-500 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}`}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {[
                { label: "Company Name", value: user?.companyName || "Demo Construction Co.", placeholder: "" },
                { label: "Admin Name", value: user?.name || "Admin", placeholder: "" },
                { label: "Email Address", value: user?.email || "", placeholder: "" },
                { label: "Phone Number", value: "+91 98765 43210", placeholder: "" },
                { label: "Company Address", value: "Ahmedabad, Gujarat 380001", placeholder: "" },
                { label: "GST Number", value: "24AABCP1234A1Z5", placeholder: "" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                  <input
                    type="text"
                    defaultValue={f.value}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  saved ? "bg-green-500 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"
                }`}
              >
                <Save className="w-4 h-4" />
                {saved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          )}

          {activeTab === "billing" && (
            <div>
              <h2 className="font-bold text-slate-900 text-lg mb-5">Subscription Plan</h2>

              {/* Current plan */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-orange-600 font-medium mb-1">Current Plan</div>
                    <div className="font-black text-2xl text-slate-900">Pro</div>
                    <div className="text-slate-500 text-sm">₹2,499/month · Renews 29 Jun 2026</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-orange-600 font-medium">Trial Status</div>
                    <div className="font-bold text-slate-900">6 days left</div>
                  </div>
                </div>
              </div>

              <h3 className="font-semibold text-slate-800 mb-4">Change Plan</h3>
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      plan.id === "pro" ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-bold text-slate-900">{plan.name}</div>
                    <div className="text-orange-600 font-semibold text-sm mt-0.5">{plan.price}</div>
                    <div className="text-xs text-slate-500 mt-1">{plan.features}</div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-5">
                <div className="text-sm font-medium text-slate-800 mb-2">Payment Method</div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">VISA</span>
                  </div>
                  <span className="text-slate-600 text-sm">•••• •••• •••• 4242</span>
                </div>
                <button className="text-xs text-orange-500 mt-2 hover:underline">Change payment method (Razorpay)</button>
              </div>

              <button className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
                Upgrade via Razorpay
              </button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div>
              <h2 className="font-bold text-slate-900 text-lg mb-5">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { label: "DPR not submitted alert", desc: "Notify when a project's daily report is missing" },
                  { label: "Payment due reminders", desc: "Remind 3 days before invoice due date" },
                  { label: "Material shortage alerts", desc: "Alert when stock falls below minimum" },
                  { label: "Task deadline reminders", desc: "Remind 24hrs before task deadline" },
                  { label: "Payroll due notifications", desc: "Alert before weekly payroll date" },
                  { label: "Cost overrun warnings", desc: "Alert when project reaches 85% of budget" },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between py-3 border-b border-slate-50">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{n.label}</div>
                      <div className="text-xs text-slate-500">{n.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-orange-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>
              <button onClick={handleSave} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
                <Save className="w-4 h-4" />
                {saved ? "Saved!" : "Save Preferences"}
              </button>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-5">
              <h2 className="font-bold text-slate-900 text-lg">Security Settings</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                <input type="password" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input type="password" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input type="password" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
                <Shield className="w-4 h-4" />
                Update Password
              </button>

              <div className="pt-4 border-t border-slate-100">
                <div className="text-sm font-medium text-slate-800 mb-2">Tenant ID</div>
                <code className="text-xs bg-slate-100 px-3 py-2 rounded-lg block text-slate-600">
                  {user?.tenantId || "tenant_demo"}
                </code>
                <p className="text-xs text-slate-400 mt-1">Your unique company identifier. Never share this.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
