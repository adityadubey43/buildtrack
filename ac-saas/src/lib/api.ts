const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bt_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data as T;
}

// ── Auth ──
export const api = {
  auth: {
    signup: (body: {
      companyName: string;
      adminName: string;
      email: string;
      password: string;
      phone?: string;
      plan?: string;
    }) => request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),

    login: (body: { email: string; password: string; tenantSlug?: string }) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

    company: (slug: string) =>
      request<{ success: boolean; data: { companyName: string; slug: string; logo?: string } }>(`/auth/company/${slug}`),

    me: () => request<{ success: boolean; user: AuthUser }>("/auth/me"),

    forgotPassword: (email: string) =>
      request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request("/auth/change-password", { method: "PUT", body: JSON.stringify(body) }),
  },

  // ── Dashboard ──
  dashboard: {
    stats: () => request<{ success: boolean; data: DashboardStats }>("/dashboard/stats"),
    analytics: () => request<{ success: boolean; data: Analytics }>("/dashboard/analytics"),
  },

  // ── Projects ──
  projects: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<Project>>(`/projects${toQuery(params)}`),
    get: (id: string) => request<SingleResponse<Project>>(`/projects/${id}`),
    create: (body: Partial<Project>) =>
      request<SingleResponse<Project>>("/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Project>) =>
      request<SingleResponse<Project>>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    updatePhase: (id: string, body: { phaseId: string; completionPct: number }) =>
      request<SingleResponse<Project>>(`/projects/${id}/phase`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/projects/${id}`, { method: "DELETE" }),
    stats: () => request<{ success: boolean; data: ProjectStats }>("/projects/stats"),
  },

  // ── Workers ──
  workers: {
    me: () => request<SingleResponse<Worker>>("/workers/me"),
    list: (params?: Record<string, string>) =>
      request<ListResponse<Worker>>(`/workers${toQuery(params)}`),
    get: (id: string) => request<SingleResponse<Worker>>(`/workers/${id}`),
    create: (body: WorkerInput) =>
      request<SingleResponse<Worker>>("/workers", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<WorkerInput>) =>
      request<SingleResponse<Worker>>(`/workers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/workers/${id}`, { method: "DELETE" }),
  },

  // ── Attendance ──
  attendance: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<AttendanceRecord>>(`/attendance${toQuery(params)}`),
    summary: (params?: Record<string, string>) =>
      request<{ success: boolean; data: AttendanceSummary }>(`/attendance/summary${toQuery(params)}`),
    weeklySummary: (params: Record<string, string>) =>
      request<ListResponse<WeeklySummaryRow>>(`/attendance/weekly-summary${toQuery(params)}`),
    monthlySummary: (params: Record<string, string>) =>
      request<MonthlySummaryResponse>(`/attendance/monthly-summary${toQuery(params)}`),
    mark: (records: AttendanceInput[]) =>
      request<{ success: boolean; message: string }>("/attendance", { method: "POST", body: JSON.stringify({ records }) }),
    // Omit `worker` to act on yourself; admin/accountant may pass a worker id to mark others
    checkIn: (body: { worker?: string; project?: string; photoUrl: string; date?: string }) =>
      request<{ success: boolean; message: string }>("/attendance/checkin", { method: "POST", body: JSON.stringify(body) }),
    checkOut: (body: { worker?: string; project?: string; photoUrl: string; date?: string }) =>
      request<{ success: boolean; message: string }>("/attendance/checkout", { method: "POST", body: JSON.stringify(body) }),
    myToday: () =>
      request<{ success: boolean; data: AttendanceRecord | null; worker: { _id?: string; name: string } }>("/attendance/me/today"),
    update: (id: string, body: Partial<AttendanceInput>) =>
      request(`/attendance/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/attendance/${id}`, { method: "DELETE" }),
  },

  // ── Payroll ──
  payroll: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<Payroll>>(`/payroll${toQuery(params)}`),
    get: (id: string) => request<SingleResponse<Payroll>>(`/payroll/${id}`),
    calculate: (body: { workerType: string; startDate: string; endDate: string; project?: string; cycle?: string }) =>
      request<SingleResponse<Payroll>>("/payroll/calculate", { method: "POST", body: JSON.stringify(body) }),
    pay: (id: string, body: { entryId?: string; payAll?: boolean; paymentMode?: string }) =>
      request<SingleResponse<Payroll>>(`/payroll/${id}/pay`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/payroll/${id}`, { method: "DELETE" }),
  },

  // ── DPR ──
  dpr: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<DPR>>(`/dpr${toQuery(params)}`),
    get: (id: string) => request<SingleResponse<DPR>>(`/dpr/${id}`),
    create: (body: Partial<DPR>) =>
      request<SingleResponse<DPR>>("/dpr", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<DPR>) =>
      request<SingleResponse<DPR>>(`/dpr/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    missingToday: () => request<ListResponse<Project>>("/dpr/missing-today"),
  },

  // ── Materials ──
  materials: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<Material>>(`/materials${toQuery(params)}`),
    create: (body: Partial<Material>) =>
      request<SingleResponse<Material>>("/materials", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Material>) =>
      request<SingleResponse<Material>>(`/materials/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    addTransaction: (id: string, body: MaterialTransaction) =>
      request(`/materials/${id}/transactions`, { method: "POST", body: JSON.stringify(body) }),
    transactions: (id: string) =>
      request<ListResponse<MaterialTransaction>>(`/materials/${id}/transactions`),
  },

  // ── Invoices ──
  invoices: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<Invoice>>(`/invoices${toQuery(params)}`),
    get: (id: string) => request<SingleResponse<Invoice>>(`/invoices/${id}`),
    create: (body: Partial<Invoice>) =>
      request<SingleResponse<Invoice>>("/invoices", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Invoice>) =>
      request<SingleResponse<Invoice>>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    recordPayment: (id: string, body: { amount: number; date: string; mode?: string; reference?: string }) =>
      request<SingleResponse<Invoice>>(`/invoices/${id}/payment`, { method: "POST", body: JSON.stringify(body) }),
    summary: () => request<{ success: boolean; data: InvoiceSummary }>("/invoices/summary"),
  },

  // ── Team ──
  team: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<TeamMember>>(`/team${toQuery(params)}`),
    invite: (body: { name: string; email: string; role: string; phone?: string; assignedSites?: string[] }) =>
      request<SingleResponse<TeamMember>>("/team", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<TeamMember>) =>
      request<SingleResponse<TeamMember>>(`/team/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => request(`/team/${id}`, { method: "DELETE" }),
  },

  // ── Equipment ──
  equipment: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<Equipment>>(`/equipment${toQuery(params)}`),
    create: (body: Partial<Equipment>) =>
      request<SingleResponse<Equipment>>("/equipment", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Equipment>) =>
      request<SingleResponse<Equipment>>(`/equipment/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    logMaintenance: (id: string, body: MaintenanceLog) =>
      request(`/equipment/${id}/maintenance`, { method: "POST", body: JSON.stringify(body) }),
  },

  // ── Expenses ──
  expenses: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<Expense>>(`/expenses${toQuery(params)}`),
    summary: (params?: Record<string, string>) =>
      request<{ success: boolean; data: ExpenseSummary }>(`/expenses/summary${toQuery(params)}`),
    create: (body: ExpenseInput) =>
      request<SingleResponse<Expense>>("/expenses", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: ExpenseInput) =>
      request<SingleResponse<Expense>>(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/expenses/${id}`, { method: "DELETE" }),
  },

  // ── Payments Received ──
  payments: {
    list: (params?: Record<string, string>) =>
      request<ListResponse<PaymentReceived>>(`/payments${toQuery(params)}`),
    summary: (params?: Record<string, string>) =>
      request<{ success: boolean; data: PaymentSummary }>(`/payments/summary${toQuery(params)}`),
    create: (body: PaymentInput) =>
      request<SingleResponse<PaymentReceived>>("/payments", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: PaymentInput) =>
      request<SingleResponse<PaymentReceived>>(`/payments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/payments/${id}`, { method: "DELETE" }),
  },
};

// ── Helpers ──
function toQuery(params?: Record<string, string>): string {
  if (!params) return "";
  const qs = new URLSearchParams(params).toString();
  return qs ? `?${qs}` : "";
}

// ── Types ──
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  slug?: string;
  companyName: string;
  plan: string;
  planStatus: string;
  trialEndsAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
}

export interface ListResponse<T> {
  success: boolean;
  count: number;
  data: T[];
}

export interface SingleResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface Project {
  _id: string;
  name: string;
  location: string;
  clientName?: string;
  budget: number;
  amountSpent: number;
  startDate: string;
  endDate: string;
  currentPhase: string;
  overallProgress: number;
  status: string;
  phases: { _id: string; name: string; completionPct: number; isCompleted: boolean }[];
}

export interface Worker {
  _id: string;
  name: string;
  phone?: string;
  role: string;
  workerType: "labour" | "employee";
  wageType: string;
  dailyWage: number;
  monthlySalary?: number;
  assignedSite?: { _id: string; name: string };
  isActive: boolean;
}

export interface WorkerInput {
  name: string;
  phone?: string;
  role: string;
  workerType: "labour" | "employee";
  wageType?: string;
  dailyWage?: number;
  monthlySalary?: number;
  assignedSite?: string;
}

export interface AttendanceRecord {
  _id: string;
  worker: { _id: string; name: string; role: string; dailyWage: number; monthlySalary?: number; workerType?: string };
  project: { _id: string; name: string };
  attendanceType: "labour" | "employee";
  date: string;
  status: "present" | "absent" | "half-day" | "late" | "leave";
  timeIn?: string;
  timeOut?: string;
  checkInAt?: string;
  checkOutAt?: string;
  checkInPhoto?: string;
  checkOutPhoto?: string;
  hoursWorked?: number;
  photoUrl?: string;
  overtimeHours: number;
}

export interface AttendanceInput {
  worker: string;
  project: string;
  attendanceType: "labour" | "employee";
  date: string;
  status: string;
  timeIn?: string;
  timeOut?: string;
  overtimeHours?: number;
  photoUrl?: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  total: number;
}

export interface WeeklySummaryRow {
  workerId: string;
  name: string;
  role: string;
  dailyWage: number;
  present: number;
  absent: number;
  halfDays: number;
  late: number;
  leave: number;
  overtimeHours: number;
  daysWorked: number;
  sites: string[];
}

export interface MonthlySummaryRow {
  workerId: string;
  name: string;
  role: string;
  monthlySalary: number;
  present: number;
  absent: number;
  leave: number;
  halfDays: number;
  late: number;
  totalHours: number;
  records: { date: string; status: string; timeIn?: string; timeOut?: string; hoursWorked?: number }[];
}

export interface MonthlySummaryResponse {
  success: boolean;
  month: number;
  year: number;
  daysInMonth: number;
  count: number;
  data: MonthlySummaryRow[];
}

export interface Payroll {
  _id: string;
  workerType: "labour" | "employee";
  cycle: string;
  weekLabel: string;
  weekStartDate: string;
  weekEndDate: string;
  project?: { _id: string; name: string };
  entries: PayrollEntry[];
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
}

export interface PayrollEntry {
  _id: string;
  worker: { _id: string; name: string; role: string; workerType?: string };
  project?: { _id: string; name: string };
  daysWorked: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  halfDays: number;
  overtimeHours: number;
  dailyWage: number;
  monthlySalary: number;
  basicAmount: number;
  overtimeAmount: number;
  deductions: number;
  totalAmount: number;
  status: string;
  paidOn?: string;
}

export interface DPR {
  _id: string;
  project: { _id: string; name: string; location: string };
  date: string;
  submittedBy: { _id: string; name: string; role: string };
  workActivity: string;
  workDescription?: string;
  workersPresent: number;
  weather: string;
  images: { url: string; caption?: string; type: string }[];
  hasDelay: boolean;
  delayReason?: string;
  delayHours: number;
  status: string;
}

export interface Material {
  _id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  project?: { _id: string; name: string };
  vendor?: string;
  lastPurchasePrice: number;
  onOrder: number;
}

export interface MaterialTransaction {
  type: "purchase" | "usage" | "return" | "transfer";
  quantity: number;
  rate?: number;
  vendor?: string;
  project?: string;
  notes?: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  project: { _id: string; name: string };
  clientName: string;
  milestone?: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  invoiceDate: string;
  dueDate: string;
  status: string;
  payments: { amount: number; date: string; mode: string }[];
}

export interface InvoiceSummary {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  count: Record<string, number>;
}

export interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  assignedSites?: { _id: string; name: string }[];
  isActive: boolean;
  createdAt: string;
}

export interface Equipment {
  _id: string;
  name: string;
  type: string;
  ownershipType: string;
  assignedProject?: { _id: string; name: string };
  status: string;
  totalHoursUsed: number;
  nextMaintenanceDate?: string;
}

export interface MaintenanceLog {
  date: string;
  type: string;
  description?: string;
  cost?: number;
  performedBy?: string;
  nextDueDate?: string;
}

export interface Expense {
  _id: string;
  project: { _id: string; name: string; location: string };
  type: "labour" | "material" | "miscellaneous" | "travel";
  description: string;
  amount: number;
  date: string;
  vendor?: string;
  paymentMode: string;
  notes?: string;
  attachments: { url: string; name: string }[];
  recordedBy?: { _id: string; name: string };
}

export interface ExpenseInput {
  project: string;
  type: string;
  description: string;
  amount: number;
  date?: string;
  vendor?: string;
  paymentMode?: string;
  notes?: string;
  attachments?: { url: string; name: string }[];
}

export interface ExpenseSummary {
  grandTotal: number;
  byType: { _id: string; total: number; count: number }[];
  byProject: { _id: string; total: number; project: { name: string; location: string } }[];
}

export interface PaymentReceived {
  _id: string;
  project: { _id: string; name: string; location: string };
  clientName: string;
  amount: number;
  date: string;
  paymentMode: string;
  reference?: string;
  milestone?: string;
  notes?: string;
  attachments: { url: string; name: string }[];
  recordedBy?: { _id: string; name: string };
}

export interface PaymentInput {
  project: string;
  clientName: string;
  amount: number;
  date?: string;
  paymentMode?: string;
  reference?: string;
  milestone?: string;
  notes?: string;
  attachments?: { url: string; name: string }[];
}

export interface PaymentSummary {
  grandTotal: number;
  byProject: { projectId: string; projectName: string; total: number }[];
}

export interface ProjectFinancial {
  projectId: string;
  projectName: string;
  location: string;
  totalExpenses: number;
  totalPayments: number;
  profit: number;
  overallProgress: number;
  status: string;
}

export interface DashboardStats {
  activeProjects: number;
  totalWorkers: number;
  todayPresent: number;
  attendanceRate: number;
  pendingPayroll: number;
  pendingInvoices: number;
  lowStockAlerts: number;
  missingDPRsToday: number;
  projects: Project[];
  recentDPRs: DPR[];
  totalExpenses: number;
  totalPaymentsReceived: number;
  profit: number;
  projectFinancials: ProjectFinancial[];
}

export interface Analytics {
  monthlyRevenue: { _id: { year: number; month: number }; revenue: number; count: number }[];
  projectPerformance: { name: string; budget: number; amountSpent: number; overallProgress: number }[];
  workerDistribution: { _id: string; count: number }[];
}

export interface ProjectStats {
  total: number;
  active: number;
  delayed: number;
  overBudget: number;
}
