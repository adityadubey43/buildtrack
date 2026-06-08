const Razorpay = require("razorpay");
const PlatformAdmin = require("../models/PlatformAdmin");
const PlatformConfig = require("../models/PlatformConfig");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Project = require("../models/Project");
const Worker = require("../models/Worker");
const Attendance = require("../models/Attendance");
const { signPlatformToken } = require("../middleware/platformAuth");

// ── Razorpay helper (lazy) ────────────────────────────────────────────────────
function getRzp() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

// Creates a monthly Razorpay plan and returns the plan ID
async function createRazorpayPlan(rzp, planName, amountRupees) {
  const plan = await rzp.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `BuildTrack ${planName.charAt(0).toUpperCase() + planName.slice(1)} (Monthly)`,
      amount: amountRupees * 100,
      currency: "INR",
      description: `BuildTrack ${planName} — ₹${amountRupees}/month`,
    },
    notes: { plan: planName, billing: "monthly" },
  });
  return plan.id;
}

// ── Helpers to get live pricing from DB ─────────────────────────────────────
async function getMonthlyPrices() {
  const cfg = await PlatformConfig.findOne({ key: "main" });
  if (cfg) return { basic: cfg.pricing.basic, pro: cfg.pricing.pro, enterprise: cfg.pricing.enterprise };
  return { basic: 999, pro: 2499, enterprise: 4999 };
}

function calcYearlyPrices(monthly, discountPct = 10) {
  const mult = (1 - discountPct / 100) * 12;
  return {
    basic:      Math.round(monthly.basic      * mult),
    pro:        Math.round(monthly.pro        * mult),
    enterprise: Math.round(monthly.enterprise * mult),
  };
}

// Synchronous fallback prices (used when we have already fetched monthly)
let _monthly = { basic: 999, pro: 2499, enterprise: 4999 };
let _yearly  = calcYearlyPrices(_monthly);

// A tenant is on yearly billing if they have subscriptionEndsAt set,
// OR if they are active and trialEndsAt is set far in the future (>30 days)
function isYearlyTenant(tenant) {
  if (tenant.subscriptionEndsAt) return true;
  if (tenant.planStatus === "active" && tenant.trialEndsAt) {
    const daysUntilEnd = (new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000;
    return daysUntilEnd > 30;
  }
  return false;
}

// ✅ FIXED: Get actual revenue based on price they signed up at (immutable)
// Falls back to current pricing for legacy tenants without subscriptionPrice
function tenantRevenue(tenant, monthly, yearly) {
  // If subscriptionPrice is stored, use it (actual amount paid)
  if (tenant.subscriptionPrice?.amount) {
    return tenant.subscriptionPrice.amount;
  }
  // Fallback: Calculate from current pricing (for legacy data)
  const prices = isYearlyTenant(tenant) ? yearly : monthly;
  return prices[tenant.plan] || 0;
}

// ✅ FIXED: Get actual MRR based on price they signed up at (immutable)
function tenantMRR(tenant, monthly, yearly) {
  // If subscriptionPrice is stored, use it
  if (tenant.subscriptionPrice?.amount) {
    if (tenant.subscriptionPrice.billing === "yearly") {
      return Math.round(tenant.subscriptionPrice.amount / 12);
    }
    return tenant.subscriptionPrice.amount; // monthly
  }
  // Fallback: Calculate from current pricing (for legacy data)
  if (isYearlyTenant(tenant)) {
    return Math.round((yearly[tenant.plan] || 0) / 12);
  }
  return monthly[tenant.plan] || 0;
}

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
      monthly,
    ] = await Promise.all([
      Tenant.countDocuments({}),
      Tenant.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Tenant.aggregate([{ $group: { _id: "$planStatus", count: { $sum: 1 } } }]),
      Tenant.aggregate([{ $match: { planStatus: "active" } }, { $group: { _id: "$plan", count: { $sum: 1 } } }]),
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
      // ✅ IMPORTANT: Fetch subscriptionPrice to calculate based on historical pricing
      Tenant.find({ planStatus: "active" }, "plan subscriptionEndsAt trialEndsAt planStatus subscriptionPrice"),
      getMonthlyPrices(),
    ]);

    const yearly = calcYearlyPrices(monthly);

    const byStatus = { trial: 0, active: 0, expired: 0, cancelled: 0 };
    byStatusRaw.forEach((r) => { byStatus[r._id] = r.count; });

    const byPlan = { basic: 0, pro: 0, enterprise: 0 };
    byPlanRaw.forEach((r) => { if (r._id) byPlan[r._id] = r.count; });

    // ✅ FIXED: Now calculates based on actual prices paid (immutable), not current pricing
    const mrr = activePlanTenants.reduce((s, t) => s + tenantMRR(t, monthly, yearly), 0);
    const totalRevenue = activePlanTenants.reduce((s, t) => s + tenantRevenue(t, monthly, yearly), 0);
    const trialTenants = await Tenant.find({ planStatus: "trial" }, "plan subscriptionEndsAt subscriptionPrice");
    const trialPipeline = trialTenants.reduce((s, t) => s + tenantMRR(t, monthly, yearly), 0);

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
        totalRevenue,
        trialPipeline,
        usage: { totalUsers, totalWorkers, totalProjects },
        trialsEndingSoon,
        recentCompanies,
        monthlySignups,
        planPrices: monthly,
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

    const [tenants, userCounts, projectCounts, monthly] = await Promise.all([
      // ✅ IMPORTANT: Fetch subscriptionPrice to calculate based on historical pricing
      Tenant.find(filter).sort({ createdAt: -1 }),
      User.aggregate([{ $group: { _id: "$tenantId", c: { $sum: 1 } } }]),
      Project.aggregate([{ $group: { _id: "$tenantId", c: { $sum: 1 } } }]),
      getMonthlyPrices(),
    ]);
    const yearly = calcYearlyPrices(monthly);

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
      subscriptionStartedAt: t.subscriptionStartedAt,
      subscriptionEndsAt: t.subscriptionEndsAt,
      billingCycle: isYearlyTenant(t) ? "yearly" : "monthly",
      createdAt: t.createdAt,
      users: uMap[t.tenantId] || 0,
      projects: pMap[t.tenantId] || 0,
      // ✅ FIXED: amountPaid now reflects historical pricing, not current pricing
      amountPaid: t.planStatus === "active" ? tenantRevenue(t, monthly, yearly) : 0,
      // ✅ FIXED: MRR now reflects historical pricing, not current pricing
      mrr: t.planStatus === "active" ? tenantMRR(t, monthly, yearly) : 0,
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

// GET /api/platform/pricing — public, returns current plan prices
const getPricing = async (req, res, next) => {
  try {
    const cfg = await PlatformConfig.findOne({ key: "main" });
    const discountPct = cfg?.pricing?.yearlyDiscount ?? 10;
    const monthly = { basic: cfg?.pricing?.basic ?? 999, pro: cfg?.pricing?.pro ?? 2499, enterprise: cfg?.pricing?.enterprise ?? 4999 };
    const yearly  = calcYearlyPrices(monthly, discountPct);
    res.json({ success: true, data: { monthly, yearly, yearlyDiscount: discountPct, razorpayPlanIds: cfg?.razorpayPlanIds ?? {} } });
  } catch (err) {
    next(err);
  }
};

// PUT /api/platform/pricing — platform admin only
// Saves prices to DB, then auto-creates new Razorpay plans at those prices
const setPricing = async (req, res, next) => {
  try {
    const { basic, pro, enterprise, yearlyDiscount } = req.body;
    if (
      (basic          !== undefined && (typeof basic          !== "number" || basic          < 0)) ||
      (pro            !== undefined && (typeof pro            !== "number" || pro            < 0)) ||
      (enterprise     !== undefined && (typeof enterprise     !== "number" || enterprise     < 0)) ||
      (yearlyDiscount !== undefined && (typeof yearlyDiscount !== "number" || yearlyDiscount < 0 || yearlyDiscount > 100))
    ) {
      return res.status(400).json({ success: false, message: "Invalid pricing values." });
    }

    // 1. Save prices to DB
    const priceUpdate = {};
    if (basic          !== undefined) priceUpdate["pricing.basic"]          = basic;
    if (pro            !== undefined) priceUpdate["pricing.pro"]            = pro;
    if (enterprise     !== undefined) priceUpdate["pricing.enterprise"]     = enterprise;
    if (yearlyDiscount !== undefined) priceUpdate["pricing.yearlyDiscount"] = yearlyDiscount;

    let cfg = await PlatformConfig.findOneAndUpdate(
      { key: "main" },
      { $set: priceUpdate },
      { upsert: true, new: true }
    );

    const monthly = { basic: cfg.pricing.basic, pro: cfg.pricing.pro, enterprise: cfg.pricing.enterprise };
    const yearly  = calcYearlyPrices(monthly, cfg.pricing.yearlyDiscount);

    // 2. Auto-create Razorpay plans at the new prices (if Razorpay is configured)
    const rzp = getRzp();
    const planWarnings = [];
    if (rzp) {
      const planIds = {};
      for (const [name, price] of Object.entries(monthly)) {
        try {
          planIds[name] = await createRazorpayPlan(rzp, name, price);
          console.log(`[pricing] Created Razorpay plan for ${name} at ₹${price}: ${planIds[name]}`);
        } catch (e) {
          const msg = `Razorpay plan for "${name}" failed: ${e?.error?.description || e?.message}`;
          console.warn("[pricing]", msg);
          planWarnings.push(msg);
        }
      }

      if (Object.keys(planIds).length) {
        // 3. Save new plan IDs to DB
        const planUpdate = {};
        for (const [name, id] of Object.entries(planIds)) {
          planUpdate[`razorpayPlanIds.${name}`] = id;
        }
        cfg = await PlatformConfig.findOneAndUpdate(
          { key: "main" },
          { $set: planUpdate },
          { new: true }
        );
      }
    } else {
      planWarnings.push("Razorpay not configured — plan IDs not created.");
    }

    res.json({
      success: true,
      message: planWarnings.length
        ? `Pricing saved. Warnings: ${planWarnings.join("; ")}`
        : "Pricing saved and Razorpay plans updated.",
      data: {
        monthly,
        yearly,
        yearlyDiscount: cfg.pricing.yearlyDiscount,
        razorpayPlanIds: cfg.razorpayPlanIds,
        warnings: planWarnings,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, getMe, getStats, getCompanies, updateCompany, getPricing, setPricing };
