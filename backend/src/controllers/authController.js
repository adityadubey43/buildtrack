const User = require("../models/User");
const Tenant = require("../models/Tenant");
const { generateToken, generateTenantId, generateUniqueSlug } = require("../utils/generateToken");

// Shape the user object returned to the client (includes tenant slug + login URL)
function userPayload(user, tenant) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    slug: tenant.slug,
    companyName: tenant.companyName,
    plan: tenant.plan,
    planStatus: tenant.planStatus,
    trialEndsAt: tenant.trialEndsAt,
    subscriptionStartedAt: tenant.subscriptionStartedAt,
    subscriptionEndsAt: tenant.subscriptionEndsAt,
  };
}

// POST /api/auth/signup
const signup = async (req, res, next) => {
  try {
    const { companyName, adminName, email, password, phone, plan = "pro" } = req.body;

    if (!companyName || !adminName || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const tenantId = generateTenantId();
    const slug = await generateUniqueSlug(Tenant, companyName);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tenant = await Tenant.create({
      tenantId,
      slug,
      companyName,
      phone,
      plan,
      planStatus: "trial",
      trialEndsAt,
    });

    // Email is unique per company (not globally), so the same person can belong
    // to more than one company. Guard against a duplicate within this new tenant.
    const existing = await User.findOne({ tenantId, email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already registered for this company." });
    }

    const user = await User.create({
      tenantId,
      name: adminName,
      email: email.toLowerCase(),
      password,
      phone,
      role: "admin",
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Company account created successfully.",
      token,
      user: userPayload(user, tenant),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
// Body: { email, password, tenantSlug? }
// On a company login page, pass tenantSlug to scope the login to that company.
const login = async (req, res, next) => {
  try {
    const { email, password, tenantSlug } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    const lcEmail = email.toLowerCase();

    let user;
    let tenant;

    if (tenantSlug) {
      // Scoped login via a company URL (/c/<slug>)
      tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() });
      if (!tenant) {
        return res.status(404).json({ success: false, message: "Company not found." });
      }
      user = await User.findOne({ tenantId: tenant.tenantId, email: lcEmail }).select("+password");
      if (!user) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }
    } else {
      // Generic login — resolve which company this email belongs to
      const matches = await User.find({ email: lcEmail }).select("+password");
      if (matches.length === 0) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }
      if (matches.length > 1) {
        // Same email in multiple companies — ask which one (use the company link)
        const tenants = await Tenant.find({ tenantId: { $in: matches.map((m) => m.tenantId) } }, "companyName slug");
        return res.status(409).json({
          success: false,
          needsCompany: true,
          message: "This email is registered with multiple companies. Choose your company.",
          companies: tenants.map((t) => ({ companyName: t.companyName, slug: t.slug })),
        });
      }
      user = matches[0];
      tenant = await Tenant.findOne({ tenantId: user.tenantId });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (!tenant || !tenant.isActive) {
      return res.status(403).json({ success: false, message: "Company account is inactive." });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: userPayload(user, tenant),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    res.json({ success: true, user: userPayload(user, tenant) });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/company/:slug — public: fetch a company's branding for its login page
const getCompanyBySlug = async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ slug: req.params.slug.toLowerCase() }, "companyName slug logo isActive");
    if (!tenant || !tenant.isActive) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }
    res.json({ success: true, data: { companyName: tenant.companyName, slug: tenant.slug, logo: tenant.logo } });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: "If an account exists with that email, a reset link has been sent.",
    });
    // TODO: integrate email sending (nodemailer / SendGrid)
  } catch (err) {
    next(err);
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both passwords are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters." });
    }

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect." });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    next(err);
  }
};

module.exports = { signup, login, getMe, forgotPassword, changePassword, getCompanyBySlug };
