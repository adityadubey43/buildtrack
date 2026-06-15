const crypto = require("crypto");
const User   = require("../models/User");
const Tenant = require("../models/Tenant");
const { generateToken, generateTenantId, generateUniqueSlug } = require("../utils/generateToken");
const { sendEmail } = require("../utils/mailer");
const templates    = require("../utils/emailTemplates");

function userPayload(user, tenant) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    slug: tenant.slug,
    companyName: tenant.companyName,
    logo: tenant.logo || null,
    phone: tenant.phone || null,
    address: tenant.address || null,
    gstNumber: tenant.gstNumber || null,
    pan: tenant.invoiceSettings?.pan || null,
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

    if (!companyName || !adminName || !email || !password)
      return res.status(400).json({ success: false, message: "All fields are required." });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

    const tenantId   = generateTenantId();
    const slug       = await generateUniqueSlug(Tenant, companyName);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tenant = await Tenant.create({ tenantId, slug, companyName, phone, plan, planStatus: "trial", trialEndsAt });

    const existing = await User.findOne({ tenantId, email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ success: false, message: "Email already registered for this company." });

    const user = await User.create({ tenantId, name: adminName, email: email.toLowerCase(), password, phone, role: "admin" });

    const token = generateToken(user._id);

    // Welcome email (fire-and-forget)
    const tpl = templates.welcome({
      adminName,
      companyName,
      email: user.email,
      plan,
      trialEndsAt,
      loginUrl: `${process.env.FRONTEND_URL || ""}/${slug}/dashboard`,
    });
    sendEmail({ to: user.email, ...tpl });

    res.status(201).json({ success: true, message: "Company account created successfully.", token, user: userPayload(user, tenant) });
  } catch (err) { next(err); }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password, tenantSlug } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password are required." });
    const lcEmail = email.toLowerCase();

    let user, tenant;

    if (tenantSlug) {
      tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() });
      if (!tenant) return res.status(404).json({ success: false, message: "Company not found." });
      user = await User.findOne({ tenantId: tenant.tenantId, email: lcEmail }).select("+password");
      if (!user) return res.status(401).json({ success: false, message: "Invalid email or password." });
    } else {
      const matches = await User.find({ email: lcEmail }).select("+password");
      if (matches.length === 0)
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      if (matches.length > 1) {
        const tenants = await Tenant.find({ tenantId: { $in: matches.map((m) => m.tenantId) } }, "companyName slug");
        return res.status(409).json({ success: false, needsCompany: true, message: "This email is registered with multiple companies. Choose your company.", companies: tenants.map((t) => ({ companyName: t.companyName, slug: t.slug })) });
      }
      user   = matches[0];
      tenant = await Tenant.findOne({ tenantId: user.tenantId });
    }

    if (!user.isActive)   return res.status(403).json({ success: false, message: "Your account has been deactivated." });
    const isMatch = await user.comparePassword(password);
    if (!isMatch)         return res.status(401).json({ success: false, message: "Invalid email or password." });
    if (!tenant || !tenant.isActive) return res.status(403).json({ success: false, message: "Company account is inactive." });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: "Login successful.", token: generateToken(user._id), user: userPayload(user, tenant) });
  } catch (err) { next(err); }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user   = await User.findById(req.user._id);
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    res.json({ success: true, user: userPayload(user, tenant) });
  } catch (err) { next(err); }
};

// GET /api/auth/company/:slug
const getCompanyBySlug = async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ slug: req.params.slug.toLowerCase() }, "companyName slug logo isActive");
    if (!tenant || !tenant.isActive)
      return res.status(404).json({ success: false, message: "Company not found." });
    res.json({ success: true, data: { companyName: tenant.companyName, slug: tenant.slug, logo: tenant.logo } });
  } catch (err) { next(err); }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });

    // Always return success — prevents email enumeration
    res.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });

    const users = await User.find({ email: email.toLowerCase() });
    if (!users.length) return; // no such user, but we already responded 200

    for (const user of users) {
      const rawToken  = crypto.randomBytes(32).toString("hex");
      const hashed    = crypto.createHash("sha256").update(rawToken).digest("hex");

      user.resetToken       = hashed;
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save({ validateBeforeSave: false });

      const tenant = await Tenant.findOne({ tenantId: user.tenantId }, "companyName slug");
      const resetUrl = `${process.env.FRONTEND_URL || ""}/reset-password?token=${rawToken}&tenantId=${user.tenantId}`;

      const tpl = templates.forgotPassword({ name: user.name, resetUrl });
      sendEmail({ to: user.email, ...tpl });
    }
  } catch (err) { next(err); }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { token, tenantId, newPassword } = req.body;
    if (!token || !tenantId || !newPassword)
      return res.status(400).json({ success: false, message: "Token, tenantId, and new password are required." });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user   = await User.findOne({
      tenantId,
      resetToken: hashed,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user)
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired." });

    user.password         = newPassword;
    user.resetToken       = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    // Confirmation email (fire-and-forget)
    const tpl = templates.passwordChanged({ name: user.name });
    sendEmail({ to: user.email, ...tpl });

    res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (err) { next(err); }
};

// PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: "Both passwords are required." });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters." });

    const user    = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch)
      return res.status(400).json({ success: false, message: "Current password is incorrect." });

    user.password = newPassword;
    await user.save();

    // Confirmation email
    const tpl = templates.passwordChanged({ name: user.name });
    sendEmail({ to: user.email, ...tpl });

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) { next(err); }
};

// GET /api/auth/invoice-settings
const getInvoiceSettings = async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });

    const settings = tenant.invoiceSettings ? tenant.invoiceSettings.toObject() : {};
    res.json({
      success: true,
      data: {
        ...settings,
        companyName: tenant.companyName,
        address: tenant.address,
        phone: tenant.phone,
        gstin: tenant.gstNumber,
        logo: tenant.logo,
      },
    });
  } catch (err) { next(err); }
};

// PUT /api/auth/invoice-settings
const updateInvoiceSettings = async (req, res, next) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.tenantId },
      { $set: { invoiceSettings: req.body } },
      { new: true, runValidators: true }
    );
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });
    res.json({ success: true, data: tenant.invoiceSettings });
  } catch (err) { next(err); }
};

// PUT /api/auth/company
const updateCompanyProfile = async (req, res, next) => {
  try {
    const { logo, companyName, phone, address, gstNumber, pan } = req.body;
    const tenantUpdate = {};
    if (typeof logo        !== "undefined") tenantUpdate.logo        = logo;
    if (typeof companyName !== "undefined" && companyName.trim()) tenantUpdate.companyName = companyName.trim();
    if (typeof phone       !== "undefined") tenantUpdate.phone       = phone;
    if (typeof address     !== "undefined") tenantUpdate.address     = address;
    if (typeof gstNumber   !== "undefined") tenantUpdate.gstNumber   = gstNumber;

    const update = { $set: tenantUpdate };
    if (typeof pan !== "undefined") update.$set["invoiceSettings.pan"] = pan;

    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.tenantId },
      update,
      { new: true }
    );
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });

    const user = await User.findById(req.user._id);
    res.json({ success: true, user: userPayload(user, tenant) });
  } catch (err) { next(err); }
};

module.exports = { signup, login, getMe, forgotPassword, resetPassword, changePassword, getCompanyBySlug, getInvoiceSettings, updateInvoiceSettings, updateCompanyProfile };
