const Razorpay = require("razorpay");
const crypto = require("crypto");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const { generateToken, generateTenantId, generateUniqueSlug } = require("../utils/generateToken");

// ── Lazy Razorpay instance ────────────────────────────────────────────────────
let _rzp = null;
function getRzp() {
  if (!_rzp) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set.");
    }
    _rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _rzp;
}

// ── HMAC signature verification ───────────────────────────────────────────────
// Razorpay docs: https://razorpay.com/docs/payments/subscriptions/verify-signature/
// Formula: HMAC-SHA256( payment_id + "|" + subscription_id , key_secret )
function verifySignature(paymentId, subscriptionId, signature) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return expected === signature;
}

// ── User payload helper ───────────────────────────────────────────────────────
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
  };
}

const PLAN_PRICES = { basic: 999, pro: 2499, enterprise: 4999 };

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/razorpay/health  — verify credentials + env vars are all set
// ─────────────────────────────────────────────────────────────────────────────
const health = async (req, res) => {
  const missing = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_PLAN_BASIC", "RAZORPAY_PLAN_PRO", "RAZORPAY_PLAN_ENTERPRISE"]
    .filter((k) => !process.env[k]);

  if (missing.length) {
    return res.status(400).json({ success: false, message: `Missing env vars: ${missing.join(", ")}` });
  }

  try {
    await getRzp().plans.all({ count: 1 });
    res.json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      plans: {
        basic: process.env.RAZORPAY_PLAN_BASIC,
        pro: process.env.RAZORPAY_PLAN_PRO,
        enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
      },
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: `Razorpay API rejected credentials: ${e?.error?.description || e?.message}`,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/create-subscription  — public, called from signup/settings
// ─────────────────────────────────────────────────────────────────────────────
const createSubscription = async (req, res, next) => {
  try {
    const { plan = "pro", email, companyName } = req.body;
    if (!email || !companyName) {
      return res.status(400).json({ success: false, message: "email and companyName are required." });
    }

    const planId = process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}`];
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: `Plan "${plan}" is not configured. Ensure RAZORPAY_PLAN_${plan.toUpperCase()} is set in env.`,
      });
    }

    const subscription = await getRzp().subscriptions.create({
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: { company: companyName, email, plan },
    });

    res.json({
      success: true,
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: PLAN_PRICES[plan] * 100,
      plan,
    });
  } catch (err) {
    const msg = err?.error?.description || err?.message || "Subscription creation failed.";
    res.status(502).json({ success: false, message: msg });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/verify-and-signup  — public, new user paying at signup
// ─────────────────────────────────────────────────────────────────────────────
const verifyAndSignup = async (req, res, next) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      companyName, adminName, email, password, phone, plan = "pro",
    } = req.body;

    // ── Validate fields ──
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay payment fields." });
    }
    if (!companyName || !adminName || !email || !password) {
      return res.status(400).json({ success: false, message: "All signup fields are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    // ── Verify HMAC signature ──
    if (!verifySignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Please try again." });
    }

    // ── Idempotency: already created? return existing account ──
    const existing = await Tenant.findOne({ razorpaySubscriptionId: razorpay_subscription_id });
    if (existing) {
      const existingUser = await User.findOne({ tenantId: existing.tenantId, role: "admin" });
      if (existingUser) {
        return res.json({ success: true, token: generateToken(existingUser._id), user: userPayload(existingUser, existing) });
      }
    }

    // ── Create Tenant + User ──
    const tenantId = generateTenantId();
    const slug = await generateUniqueSlug(Tenant, companyName);

    const tenant = await Tenant.create({
      tenantId, slug, companyName, phone, plan,
      planStatus: "active",
      razorpaySubscriptionId: razorpay_subscription_id,
    });

    const user = await User.create({
      tenantId, name: adminName, email: email.toLowerCase(), password, phone, role: "admin",
    });

    res.status(201).json({
      success: true,
      message: "Account created and subscription activated!",
      token: generateToken(user._id),
      user: userPayload(user, tenant),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/activate-subscription  — protected, existing user from dashboard
// ─────────────────────────────────────────────────────────────────────────────
const activateSubscription = async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay payment fields." });
    }

    // ── Verify HMAC signature ──
    if (!verifySignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Please try again." });
    }

    // ── Update existing tenant ──
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    if (!tenant) return res.status(404).json({ success: false, message: "Company not found." });

    tenant.razorpaySubscriptionId = razorpay_subscription_id;
    tenant.planStatus = "active";
    await tenant.save();

    const user = await User.findById(req.user._id);
    res.json({ success: true, message: "Subscription activated!", user: userPayload(user, tenant) });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/webhook  — raw body, Razorpay lifecycle events
// ─────────────────────────────────────────────────────────────────────────────
const webhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const sig = req.headers["x-razorpay-signature"];
    const raw = req.body;

    if (secret && sig) {
      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (expected !== sig) return res.status(400).json({ message: "Invalid webhook signature." });
    }

    const { event, payload } = JSON.parse(raw.toString());
    const subscriptionId = payload?.subscription?.entity?.id;
    if (!subscriptionId) return res.json({ received: true });

    const tenant = await Tenant.findOne({ razorpaySubscriptionId: subscriptionId });
    if (!tenant) return res.json({ received: true });

    if (event === "subscription.activated" || event === "subscription.charged") {
      tenant.planStatus = "active";
    } else if (event === "subscription.halted" || event === "subscription.pending") {
      tenant.planStatus = "expired";
    } else if (event === "subscription.cancelled") {
      tenant.planStatus = "cancelled";
      tenant.isActive = false;
    }

    await tenant.save();
    res.json({ received: true });
  } catch (err) {
    console.error("[webhook error]", err.message);
    res.status(500).json({ message: "Webhook error." });
  }
};

module.exports = { health, createSubscription, verifyAndSignup, activateSubscription, webhook };
