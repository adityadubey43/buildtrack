"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getUser, clearUser } from "@/lib/store";
import type { AuthUser } from "@/lib/api";
import { canAccess } from "@/lib/permissions";
import {
  Building2, LayoutDashboard, FolderOpen, Users, Calculator,
  Package, FileText, BarChart3, Bell, Settings, LogOut,
  Menu, X, ChevronDown, Camera, Receipt, Wrench, UserCheck,
  TrendingDown, Wallet,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
  { href: "/dashboard/expenses", label: "Expenses", icon: TrendingDown },
  { href: "/dashboard/payments", label: "Payments Received", icon: Wallet },
  { href: "/dashboard/attendance/labour", label: "Site Workers", icon: Camera },
  { href: "/dashboard/attendance/employee", label: "Staff Attendance", icon: UserCheck },
  { href: "/dashboard/payroll", label: "Payroll", icon: Calculator },
  { href: "/dashboard/reports", label: "DPR & Reports", icon: FileText },
  { href: "/dashboard/materials", label: "Materials", icon: Package },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/dashboard/team", label: "Team", icon: UserCheck },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/equipment", label: "Equipment", icon: Wrench },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
    } else {
      setUserState(u);
    }
  }, [router]);

  // Route guard: block screens not permitted for this role (covers direct URL access)
  useEffect(() => {
    if (user && !canAccess(user.role, pathname)) {
      router.replace("/dashboard");
    }
  }, [user, pathname, router]);

  const handleLogout = () => {
    // Send the user back to THEIR company login page, not the public landing page
    const slug = user?.slug;
    clearUser();
    router.push(slug ? `/c/${slug}` : "/login");
  };

  // Only show nav items this role may access
  const visibleNav = user ? NAV.filter((item) => canAccess(user.role, item.href)) : [];

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const trialDaysLeft = user.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">Build<span className="text-orange-500">Track</span></span>
          </Link>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Company</div>
          <div className="text-white font-medium text-sm truncate">{user.companyName}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user.plan === "pro" ? "bg-orange-500/20 text-orange-400" :
              user.plan === "enterprise" ? "bg-purple-500/20 text-purple-400" :
              "bg-slate-700 text-slate-400"
            }`}>
              {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
            </span>
            {trialDaysLeft > 0 && (
              <span className="text-xs text-yellow-400">{trialDaysLeft}d trial</span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${
                  active ? "bg-orange-500 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {user.plan === "basic" && (
          <div className="mx-4 mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <div className="text-orange-400 text-xs font-semibold mb-1">Upgrade to Pro</div>
            <div className="text-slate-400 text-xs mb-2">Unlock unlimited projects & workers</div>
            <button className="w-full py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg">Upgrade Now</button>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-5 py-4 text-slate-500 hover:text-red-400 text-sm border-t border-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <button className="lg:hidden p-2 text-slate-600" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 lg:flex-none" />
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-slate-900">{user.name}</div>
                  <div className="text-xs text-slate-500 capitalize">{user.role}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-sm font-medium text-slate-900">{user.email}</div>
                    <div className="text-xs text-slate-500">{user.companyName}</div>
                  </div>
                  <Link href="/dashboard/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    <Settings className="w-4 h-4" />Settings
                  </Link>
                  <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 w-full">
                    <LogOut className="w-4 h-4" />Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
