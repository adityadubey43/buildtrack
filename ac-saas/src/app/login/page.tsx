"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { setUser, setToken } from "@/lib/store";
import { platformApi, setPlatformToken, setPlatformAdmin } from "@/lib/platformApi";

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.login({ email: form.email, password: form.password });
      setToken(res.token);
      setUser(res.user);
      router.push("/dashboard");
    } catch (companyErr: unknown) {
      // Not a company user — maybe this is the BuildTrack platform owner.
      try {
        const p = await platformApi.login({ email: form.email, password: form.password });
        setPlatformToken(p.token);
        setPlatformAdmin(p.admin);
        router.push("/platform");
        return;
      } catch {
        // Neither — show the original company login error
        setError(companyErr instanceof Error ? companyErr.message : "Login failed. Please try again.");
        setLoading(false);
      }
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.auth.forgotPassword(forgotEmail);
      setResetSent(true);
    } catch {
      setResetSent(true); // Don't reveal if email exists
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
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
            Welcome back to your construction command center.
          </h2>
          <p className="text-slate-300">All your projects, workers, and finances — managed in one place.</p>
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

          {!forgotMode ? (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in to your account</h1>
                <p className="text-slate-500 text-sm">
                  Don't have an account?{" "}
                  <Link href="/signup" className="text-orange-500 hover:underline font-medium">Start free trial</Link>
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="admin@yourcompany.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-orange-500 hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm pr-10"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
                  ) : "Sign In"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <button onClick={() => { setForgotMode(false); setResetSent(false); }} className="text-slate-500 text-sm hover:text-orange-500 mb-4 flex items-center gap-1">
                  ← Back to login
                </button>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Reset your password</h1>
                <p className="text-slate-500 text-sm">We'll send a reset link to your email.</p>
              </div>

              {resetSent ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <h3 className="font-semibold text-slate-900 mb-1">Check your email</h3>
                  <p className="text-slate-500 text-sm">If an account exists, we sent a password reset link.</p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="admin@yourcompany.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                  </div>
                  <button type="submit" className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors">
                    Send Reset Link
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
