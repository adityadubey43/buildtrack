// Role-based access control for the dashboard UI.
// Mirrors the backend `authorize()` rules so users only see screens they may use.

export type Role = "admin" | "partner" | "engineer" | "supervisor" | "accountant";

// Allowed route prefixes per role. "*" = everything (admin).
// "/dashboard" is matched exactly; all other entries match by prefix
// (so "/dashboard/projects" also covers "/dashboard/projects/:id").
export const ROLE_ROUTES: Record<string, string[]> = {
  admin: ["*"],
  partner: [
    "/dashboard",
    "/dashboard/projects",
    "/dashboard/reports",
    "/dashboard/settings",
  ],
  engineer: [
    "/dashboard",
    "/dashboard/projects",
    "/dashboard/attendance",
    "/dashboard/reports",
    "/dashboard/materials",
    "/dashboard/equipment",
    "/dashboard/settings",
  ],
  supervisor: [
    "/dashboard",
    "/dashboard/projects",
    "/dashboard/attendance",
    "/dashboard/reports",
    "/dashboard/settings",
  ],
  accountant: [
    "/dashboard",
    "/dashboard/payroll",
    "/dashboard/billing",
    "/dashboard/expenses",
    "/dashboard/payments",
    "/dashboard/analytics",
    "/dashboard/settings",
  ],
};

// Only admin & accountant may see any monetary / financial information.
export function canSeeFinance(role: string | undefined): boolean {
  return role === "admin" || role === "accountant";
}

export function canAccess(role: string | undefined, pathname: string): boolean {
  const allowed = ROLE_ROUTES[role || ""] || [];
  if (allowed.includes("*")) return true;
  if (pathname === "/dashboard") return allowed.includes("/dashboard");
  // Match any non-root prefix
  return allowed.some((r) => r !== "/dashboard" && (pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r)));
}
