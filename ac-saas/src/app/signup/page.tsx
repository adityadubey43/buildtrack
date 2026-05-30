"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, CheckCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { setUser, setToken } from "@/lib/store";

export default function SignupPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "plan">("form");
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | "enterprise">("pro");
  const [form, setForm] = useState({
    companyName: "",
    adminName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = "Company name is required";
    if (!form.adminName.trim()) e.adminName = "Your name is required";
    if (!form.email.match(/^[^@]+@[^@]+\.[^@]+$/)) e.email = "Valid email required";
    if (form.password.length < 8) e.password = "Password must be at least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (validate()) setStep("plan");
  };

  const handleSignup = async () => {
    setLoading(true);
    setApiError("");
    try {
      const res = await api.auth.signup({
        companyName: form.companyName,
        adminName: form.adminName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        plan: selectedPlan,
      });
      setToken(res.token);
      setUser(res.user);
      router.push("/dashboard");
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Signup failed. Please try again.");
      setLoading(false);
    }
  };

  const PLANS = [
    { id: "basic" as const, name: "Basic", price: "₹999/mo", desc: "Up to 3 projects, 25 workers" },
    { id: "pro" as const, name: "Pro", price: "₹2,499/mo", desc: "Unlimited projects & workers", popular: true },
    { id: "enterprise" as const, name: "Enterprise", price: "Custom", desc: "Large firms, custom SLA" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-2/5 gradient-hero flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl">
            Build<span className="text-orange-400">Track</span>
          </span>
        </Link>

        <div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Start managing your construction sites smarter.
          </h2>
          <p className="text-slate-300 mb-8">
            Join 500+ construction companies across India using BuildTrack.
          </p>
          <div className="space-y-4">
            {["7-day free trial, no credit card", "Your own isolated company workspace", "Mobile-ready for field teams", "GST-ready billing & invoicing"].map((b) => (
              <div key={b} className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                {b}
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-500 text-xs">© 2026 BuildTrack. All rights reserved.</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-900 font-bold text-lg">
              Build<span className="text-orange-500">Track</span>
            </span>
          </div>

          {apiError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {apiError}
            </div>
          )}

          {step === "form" ? (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your company account</h1>
                <p className="text-slate-500 text-sm">
                  Already have an account?{" "}
                  <Link href="/login" className="text-orange-500 hover:underline font-medium">Sign in</Link>
                </p>
              </div>

              <form onSubmit={handleNext} className="space-y-4">
                {[
                  { key: "companyName", label: "Company Name", placeholder: "Patel Constructions Pvt Ltd", type: "text" },
                  { key: "adminName", label: "Your Name (Admin)", placeholder: "Rajesh Patel", type: "text" },
                  { key: "email", label: "Email Address", placeholder: "admin@yourcompany.com", type: "email" },
                  { key: "phone", label: "Phone Number", placeholder: "+91 98765 43210", type: "tel" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className={`w-full px-4 py-2.5 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${errors[f.key] ? "border-red-400" : "border-slate-200"}`}
                    />
                    {errors[f.key] && <p className="text-red-500 text-xs mt-1">{errors[f.key]}</p>}
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={`w-full px-4 py-2.5 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm pr-10 ${errors.password ? "border-red-400" : "border-slate-200"}`}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                </div>

                <button type="submit" className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  Continue to Plan Selection
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-xs text-slate-400 text-center">
                  By signing up, you agree to our <a href="#" className="text-orange-500">Terms</a> and <a href="#" className="text-orange-500">Privacy Policy</a>
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <button onClick={() => setStep("form")} className="text-slate-500 text-sm hover:text-orange-500 mb-4 flex items-center gap-1">
                  ← Back
                </button>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Choose your plan</h1>
                <p className="text-slate-500 text-sm">All plans include a 7-day free trial.</p>
              </div>

              <div className="space-y-3 mb-6">
                {PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedPlan === plan.id ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{plan.name}</span>
                          {"popular" in plan && plan.popular && (
                            <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Popular</span>
                          )}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">{plan.desc}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{plan.price}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? "border-orange-500 bg-orange-500" : "border-slate-300"}`}>
                          {selectedPlan === plan.id && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleSignup}
                disabled={loading}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating your workspace...
                  </>
                ) : (
                  <>Start 7-Day Free Trial <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
