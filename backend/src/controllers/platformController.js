const PlatformAdmin = require("../models/PlatformAdmin");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Project = require("../models/Project");
const Worker = require("../models/Worker");
const Attendance = require("../models/Attendance");
const { signPlatformToken } = require("../middleware/platformAuth");

// Monthly list price per plan (₹). Enterprise is custom → not auto-counted.
const PLAN_PRICES = { basic: 999, pro: 2499, enterprise: 0 };

function adminPayload(a) {
  return { id: a._id, name: a.name, email: a.email, role: a.role };
}

// POST /api/platform/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    const admin = await PlatformAdmin.findOne({ email: email.toLowerCase() }).select("+password");
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }
    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: "Account deactivated." });
    }
    admin.lastLogin = new Date();
    await admin.save();
    res.json({ success: true, token: signPlatformToken(admin._id), admin: adminPayload(admin) });
  } catch (err) {
    next(err);
  }
};

// GET /api/platform/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, admin: adminPayload(req.platformAdmin) });
};

// GET /api/platform/stats — cross-tenant business overview
const getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalCompanies, newThisMonth, byStatusRaw, byPlanRaw,
      totalUsers, totalWorkers, totalProjects,
      trialsEndingSoon, recentCompanies, monthlySignupsRaw, activePlanTenants,
    ] = await Promise.all([
      Tenant.countDocuments({}),
      Tenant.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Tenant.aggregate([{ $group: { _id: "$planStatus", count: { $sum: 1 } } }]),
      Tenant.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
      User.countDocuments({}),
      Worker.countDocuments({}),
      Project.countDocuments({}),
      Tenant.find({ planStatus: "trial", trialEndsAt: { $gte: now, $lte: soon } }, "companyName slug trialEndsAt plan").sort({ trialEndsAt: 1 }),
      Tenant.find({}, "companyName slug plan planStatus createdAt").sort({ createdAt: -1 }).limit(8),
      Tenant.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
      ]),
      Tenant.find({ planStatus: "active" }, "plan"),
    ]);

    const byStatus = { trial: 0, active: 0, expired: 0, cancelled: 0 };
    byStatusRaw.forEach((r) => { byStatus[r._id] = r.count; });

    const byPlan = { basic: 0, pro: 0, enterprise: 0 };
    byPlanRaw.forEach((r) => { if (r._id) byPlan[r._id] = r.count; });

    // MRR from *active* subscriptions only (plan-based, until Razorpay is live)
    const mrr = activePlanTenants.reduce((s, t) => s + (PLAN_PRICES[t.plan] || 0), 0);
    // Pipeline = potential MRR sitting in trials
    const trialTenants = await Tenant.find({ planStatus: "trial" }, "plan");
    const trialPipeline = trialTenants.reduce((s, t) => s + (PLAN_PRICES[t.plan] || 0), 0);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlySignups = monthlySignupsRaw.map((r) => ({
      label: `${monthNames[r._id.m - 1]} ${String(r._id.y).slice(2)}`,
      count: r.count,
    }));

    res.json({
      success: true,
      data: {
        totalCompanies,
        newThisMonth,
        activeClients: byStatus.active,
        byStatus,
        byPlan,
        mrr,
        trialPipeline,
        usage: { totalUsers, totalWorkers, totalProjects },
        trialsEndingSoon,
        recentCompanies,
        monthlySignups,
        planPrices: PLAN_PRICES,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/platform/companies — every registered company with usage + MRR
const getCompanies = async (req, res, next) => {
  try {
    const { status, plan, search } = req.query;
    const filter = {};
    if (status) filter.planStatus = status;
    if (plan) filter.plan = plan;
    if (search) filter.companyName = { $regex: search, $options: "i" };

    const tenants = await Tenant.find(filter).sort({ createdAt: -1 });

    // Per-tenant counts in two aggregate calls
    const [userCounts, projectCounts] = await Promise.all([
      User.aggregate([{ $group: { _id: "$tenantId", c: { $sum: 1 } } }]),
      Project.aggregate([{ $group: { _id: "$tenantId", c: { $sum: 1 } } }]),
    ]);
    const uMap = Object.fromEntries(userCounts.map((x) => [x._id, x.c]));
    const pMap = Object.fromEntries(projectCounts.map((x) => [x._id, x.c]));

    const data = tenants.map((t) => ({
      tenantId: t.tenantId,
      companyName: t.companyName,
      slug: t.slug,
      plan: t.plan,
      planStatus: t.planStatus,
      isActive: t.isActive,
      trialEndsAt: t.trialEndsAt,
      createdAt: t.createdAt,
      users: uMap[t.tenantId] || 0,
      projects: pMap[t.tenantId] || 0,
      mrr: t.planStatus === "active" ? PLAN_PRICES[t.plan] || 0 : 0,
    }));

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/platform/companies/:tenantId — suspend/activate, change plan, extend trial
const updateCompany = async (req, res, next) => {
  try {
    const { isActive, plan, planStatus, extendTrialDays } = req.body;
    const tenant = await Tenant.findOne({ tenantId: req.params.tenantId });
    if (!tenant) return res.status(404).json({ success: false, message: "Company not found." });

    if (isActive !== undefined) tenant.isActive = isActive;
    if (plan) tenant.plan = plan;
    if (planStatus) tenant.planStatus = planStatus;
    if (extendTrialDays) {
      const base = tenant.trialEndsAt && tenant.trialEndsAt > new Date() ? tenant.trialEndsAt : new Date();
      tenant.trialEndsAt = new Date(base.getTime() + Number(extendTrialDays) * 24 * 60 * 60 * 1000);
      if (tenant.planStatus === "expired") tenant.planStatus = "trial";
    }

    await tenant.save();
    res.json({ success: true, message: "Company updated.", data: tenant });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, getMe, getStats, getCompanies, updateCompany };
