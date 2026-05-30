const Razorpay = require("razorpay");
const crypto   = require("crypto");
const Tenant   = require("../models/Tenant");
const User     = require("../models/User");
const { generateToken, generateTenantId, generateUniqueSlug } = require("../utils/generateToken");

// ── Lazy Razorpay instance ────────────────────────────────────────────────────
let _rzp = null;
function getRzp() {
  if (!_rzp) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set.");
    _rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return _rzp;
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const MONTHLY_PRICES = { basic: 999,  pro: 2499,  enterprise: 4999 };
const YEARLY_PRICES  = {
  basic:      Math.round(999  * 12 * 0.9),  // ₹10,789
  pro:        Math.round(2499 * 12 * 0.9),  // ₹26,989
  enterprise: Math.round(4999 * 12 * 0.9),  // ₹53,989
};

// ── HMAC helpers ──────────────────────────────────────────────────────────────
// Subscription:  HMAC( payment_id | subscription_id , secret )
function verifySubscriptionSig(paymentId, subscriptionId, sig) {
  const exp = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`).digest("hex");
  return exp === sig;
}
// Order:  HMAC( order_id | payment_id , secret )
function verifyOrderSig(orderId, paymentId, sig) {
  const exp = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`).digest("hex");
  return exp === sig;
}

// ── User payload ──────────────────────────────────────────────────────────────
function userPayload(user, tenant) {
  return {
    id: user._id, name: user.name, email: user.email, role: user.role,
    tenantId: user.tenantId, slug: tenant.slug, companyName: tenant.companyName,
    plan: tenant.plan, planStatus: tenant.planStatus, trialEndsAt: tenant.trialEndsAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/razorpay/health
// ─────────────────────────────────────────────────────────────────────────────
const health = async (req, res) => {
  const missing = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_PLAN_BASIC", "RAZORPAY_PLAN_PRO", "RAZORPAY_PLAN_ENTERPRISE"]
    .filter((k) => !process.env[k]);
  if (missing.length) return res.status(400).json({ success: false, message: `Missing env vars: ${missing.join(", ")}` });
  try {
    await getRzp().plans.all({ count: 1 });
    res.json({ success: true, keyId: process.env.RAZORPAY_KEY_ID, mode: process.env.RAZORPAY_KEY_ID.startsWith("rzp_live") ? "live" : "test" });
  } catch (e) {
    res.status(400).json({ success: false, message: `Credentials invalid: ${e?.error?.description || e?.message}`, keyId: process.env.RAZORPAY_KEY_ID });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/create-subscription  — monthly recurring
// ─────────────────────────────────────────────────────────────────────────────
const createSubscription = async (req, res) => {
  try {
    const { plan = "pro", email, companyName } = req.body;
    if (!email || !companyName) return res.status(400).json({ success: false, message: "email and companyName are required." });

    const planId = process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}`];
    if (!planId) return res.status(400).json({ success: false, message: `Plan "${plan}" not configured. Set RAZORPAY_PLAN_${plan.toUpperCase()} in env.` });

    const sub = await getRzp().subscriptions.create({
      plan_id: planId, total_count: 120, quantity: 1, customer_notify: 1,
      notes: { company: companyName, email, plan, billing: "monthly" },
    });

    res.json({ success: true, subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID, amount: MONTHLY_PRICES[plan] * 100, plan, billing: "monthly" });
  } catch (err) {
    res.status(502).json({ success: false, message: err?.error?.description || err?.message || "Subscription creation failed." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/create-order  — yearly one-time charge
// ─────────────────────────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    const { plan = "pro", email, companyName } = req.body;
    if (!email || !companyName) return res.status(400).json({ success: false, message: "email and companyName are required." });

    const amount = YEARLY_PRICES[plan];
    if (!amount) return res.status(400).json({ success: false, message: `Unknown plan "${plan}".` });

    const order = await getRzp().orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `yr_${plan}_${Date.now()}`,
      notes: { company: companyName, email, plan, billing: "yearly" },
    });

    res.json({ success: true, orderId: order.id, keyId: process.env.RAZORPAY_KEY_ID, amount: amount * 100, plan, billing: "yearly" });
  } catch (err) {
    res.status(502).json({ success: false, message: err?.error?.description || err?.message || "Order creation failed." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/verify-and-signup  — new user, handles both monthly & yearly
// ─────────────────────────────────────────────────────────────────────────────
const verifyAndSignup = async (req, res, next) => {
  try {
    const {
      // subscription fields
      razorpay_payment_id, razorpay_subscription_id, razorpay_signature,
      // order fields
      razorpay_order_id,
      // signup fields
      companyName, adminName, email, password, phone, plan = "pro", billing = "monthly",
    } = req.body;

    if (!companyName || !adminName || !email || !password)
      return res.status(400).json({ success: false, message: "All signup fields are required." });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

    // ── Verify signature based on billing type ──
    if (billing === "yearly") {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
        return res.status(400).json({ success: false, message: "Missing Razorpay order payment details." });
      if (!verifyOrderSig(razorpay_order_id, razorpay_payment_id, razorpay_signature))
        return res.status(400).json({ success: false, message: "Payment verification failed. Please try again." });
    } else {
      if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature)
        return res.status(400).json({ success: false, message: "Missing Razorpay subscription payment details." });
      if (!verifySubscriptionSig(razorpay_payment_id, razorpay_subscription_id, razorpay_signature))
        return res.status(400).json({ success: false, message: "Payment verification failed. Please try again." });
    }

    const refId = billing === "yearly" ? razorpay_order_id : razorpay_subscription_id;

    // ── Idempotency ──
    const existing = await Tenant.findOne({ razorpaySubscriptionId: refId });
    if (existing) {
      const eu = await User.findOne({ tenantId: existing.tenantId, role: "admin" });
      if (eu) return res.json({ success: true, token: generateToken(eu._id), user: userPayload(eu, existing) });
    }

    // ── Create tenant + user ──
    const tenantId = generateTenantId();
    const slug = await generateUniqueSlug(Tenant, companyName);
    const renewsAt = billing === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : null;

    const tenant = await Tenant.create({
      tenantId, slug, companyName, phone, plan,
      planStatus: "active",
      razorpaySubscriptionId: refId,
      ...(renewsAt && { trialEndsAt: renewsAt }), // repurpose trialEndsAt as renewsAt for yearly
    });

    const user = await User.create({ tenantId, name: adminName, email: email.toLowerCase(), password, phone, role: "admin" });

    res.status(201).json({
      success: true,
      message: "Account created and subscription activated!",
      token: generateToken(user._id),
      user: userPayload(user, tenant),
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/activate-subscription  — protected, existing user from dashboard
// ─────────────────────────────────────────────────────────────────────────────
const activateSubscription = async (req, res, next) => {
  try {
    const {
      razorpay_payment_id, razorpay_subscription_id, razorpay_signature,
      razorpay_order_id,
      billing = "monthly", plan,
    } = req.body;

    // ── Verify ──
    if (billing === "yearly") {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
        return res.status(400).json({ success: false, message: "Missing payment details." });
      if (!verifyOrderSig(razorpay_order_id, razorpay_payment_id, razorpay_signature))
        return res.status(400).json({ success: false, message: "Payment verification failed." });
    } else {
      if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature)
        return res.status(400).json({ success: false, message: "Missing payment details." });
      if (!verifySubscriptionSig(razorpay_payment_id, razorpay_subscription_id, razorpay_signature))
        return res.status(400).json({ success: false, message: "Payment verification failed." });
    }

    const refId = billing === "yearly" ? razorpay_order_id : razorpay_subscription_id;

    // ── Update tenant ──
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    if (!tenant) return res.status(404).json({ success: false, message: "Company not found." });

    tenant.razorpaySubscriptionId = refId;
    tenant.planStatus = "active";
    if (plan) tenant.plan = plan;
    if (billing === "yearly") tenant.trialEndsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await tenant.save();

    const user = await User.findById(req.user._id);
    res.json({ success: true, message: "Subscription activated!", user: userPayload(user, tenant) });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/razorpay/webhook
// ─────────────────────────────────────────────────────────────────────────────
const webhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const sig    = req.headers["x-razorpay-signature"];
    const raw    = req.body;

    if (secret && sig) {
      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (expected !== sig) return res.status(400).json({ message: "Invalid webhook signature." });
    }

    const { event, payload } = JSON.parse(raw.toString());
    const subscriptionId = payload?.subscription?.entity?.id;
    if (!subscriptionId) return res.json({ received: true });

    const tenant = await Tenant.findOne({ razorpaySubscriptionId: subscriptionId });
    if (!tenant) return res.json({ received: true });

    if (event === "subscription.activated" || event === "subscription.charged") tenant.planStatus = "active";
    else if (event === "subscription.halted" || event === "subscription.pending") tenant.planStatus = "expired";
    else if (event === "subscription.cancelled") { tenant.planStatus = "cancelled"; tenant.isActive = false; }

    await tenant.save();
    res.json({ received: true });
  } catch (err) {
    console.error("[webhook error]", err.message);
    res.status(500).json({ message: "Webhook error." });
  }
};

module.exports = { health, createSubscription, createOrder, verifyAndSignup, activateSubscription, webhook };
