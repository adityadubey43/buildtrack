const Razorpay = require("razorpay");
const crypto = require("crypto");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const { generateToken, generateTenantId, generateUniqueSlug } = require("../utils/generateToken");

// Lazy singleton — instantiated on first request so missing env vars don't crash startup
let _razorpay = null;
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars.");
    }
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

// Plan ID map — populated from env after running scripts/createRazorpayPlans.js
const PLAN_IDS = () => ({
  basic: process.env.RAZORPAY_PLAN_BASIC,
  pro: process.env.RAZORPAY_PLAN_PRO,
  enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
});

const PLAN_PRICES = { basic: 999, pro: 2499, enterprise: 4999 };

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── POST /api/razorpay/create-subscription ────────────────────────────────────
// Step 1 of checkout: create a Razorpay subscription starting 7 days from now.
// The user will authorise their payment method in the checkout; no charge today.
const createSubscription = async (req, res, next) => {
  try {
    const { plan = "pro", email, companyName } = req.body;
    if (!plan || !email || !companyName) {
      return res.status(400).json({ success: false, message: "plan, email, and companyName are required." });
    }

    const planIds = PLAN_IDS();
    const planId = planIds[plan];
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: `Razorpay plan not configured for "${plan}". Run scripts/createRazorpayPlans.js first.`,
      });
    }

    let subscription;
    try {
      subscription = await getRazorpay().subscriptions.create({
        plan_id: planId,
        total_count: 120, // 10 years max billing cycles
        quantity: 1,
        customer_notify: 1,
        notes: {
          company: companyName,
          email,
          plan,
        },
      });
    } catch (rzpErr) {
      // Surface the actual Razorpay error message instead of a generic 500
      const description =
        rzpErr?.error?.description ||
        rzpErr?.error?.error?.description ||
        rzpErr?.message ||
        "Razorpay subscription creation failed.";
      return res.status(502).json({ success: false, message: description, rzpError: rzpErr?.error || null });
    }

    res.json({
      success: true,
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: PLAN_PRICES[plan] * 100, // in paise (for display only — trial = ₹0 today)
      plan,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/razorpay/verify-and-signup ──────────────────────────────────────
// Step 2: frontend sends back the Razorpay success payload.
// We verify the subscription directly via Razorpay API (server-to-server) — this is
// more reliable than HMAC for future-start subscriptions where razorpay_payment_id
// Verifies a Razorpay payment using HMAC signature — no API call needed.
// Razorpay docs: https://razorpay.com/docs/payments/subscriptions/verify-signature/
function verifyRazorpaySignature(paymentId, subscriptionId, signature) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return expected === signature;
}

const verifyAndSignup = async (req, res, next) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      companyName,
      adminName,
      email,
      password,
      phone,
      plan = "pro",
    } = req.body;

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay payment details." });
    }
    if (!companyName || !adminName || !email || !password) {
      return res.status(400).json({ success: false, message: "All signup fields are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    // ── HMAC signature verification (Razorpay recommended approach) ──
    if (!verifyRazorpaySignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Please try again." });
    }

    // ── Idempotency — don't double-create ──
    const existing = await Tenant.findOne({ razorpaySubscriptionId: razorpay_subscription_id });
    if (existing) {
      const existingUser = await User.findOne({ tenantId: existing.tenantId, role: "admin" });
      if (existingUser) {
        return res.json({
          success: true,
          token: generateToken(existingUser._id),
          user: userPayload(existingUser, existing),
        });
      }
    }

    // ── Create Tenant ──
    const tenantId = generateTenantId();
    const slug = await generateUniqueSlug(Tenant, companyName);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tenant = await Tenant.create({
      tenantId,
      slug,
      companyName,
      phone,
      plan,
      planStatus: "active", // paid upfront — not trial
      razorpaySubscriptionId: razorpay_subscription_id,
    });

    // ── Create admin User ──
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
      message: "Company account created. Your 7-day free trial has started!",
      token,
      user: userPayload(user, tenant),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/razorpay/activate-subscription ─────────────────────────────────
// For EXISTING logged-in users activating their subscription from the dashboard.
// Verifies the Razorpay subscription and updates the existing tenant — does NOT create a new account.
const activateSubscription = async (req, res, next) => {
  try {
    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay payment details." });
    }

    // ── HMAC signature verification ──
    if (!verifyRazorpaySignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Please try again." });
    }

    // ── Update existing tenant ──
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Company account not found." });
    }

    tenant.razorpaySubscriptionId = razorpay_subscription_id;
    tenant.planStatus = "active";
    await tenant.save();

    const user = await require("../models/User").findById(req.user._id);

    res.json({
      success: true,
      message: "Subscription activated successfully!",
      user: userPayload(user, tenant),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/razorpay/webhook ────────────────────────────────────────────────
// Razorpay calls this for subscription lifecycle events.
// IMPORTANT: mount with express.raw() so the body isn't parsed — signature needs raw bytes.
const webhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body; // Buffer (raw middleware)

    if (!webhookSecret) {
      console.warn("RAZORPAY_WEBHOOK_SECRET not set — skipping webhook verification");
    } else {
      const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
      if (expected !== signature) {
        return res.status(400).json({ message: "Invalid webhook signature." });
      }
    }

    const payload = JSON.parse(rawBody.toString());
    const { event } = payload;
    const subEntity = payload?.payload?.subscription?.entity;
    const subscriptionId = subEntity?.id;

    if (!subscriptionId) return res.json({ received: true });

    const tenant = await Tenant.findOne({ razorpaySubscriptionId: subscriptionId });
    if (!tenant) return res.json({ received: true }); // unknown subscription — ignore

    console.log(`[Razorpay webhook] ${event} → tenant ${tenant.companyName}`);

    switch (event) {
      case "subscription.authenticated":
        // User completed checkout — already handled by verifyAndSignup; just ensure trial status
        if (tenant.planStatus !== "trial") {
          tenant.planStatus = "trial";
          await tenant.save();
        }
        break;

      case "subscription.activated":
      case "subscription.charged":
        // Trial ended, first (or recurring) payment succeeded
        tenant.planStatus = "active";
        await tenant.save();
        break;

      case "subscription.halted":
      case "subscription.pending":
        // Payment failed / retrying
        tenant.planStatus = "expired";
        await tenant.save();
        break;

      case "subscription.cancelled":
        tenant.planStatus = "cancelled";
        tenant.isActive = false;
        await tenant.save();
        break;

      default:
        // Other events (subscription.updated, etc.) — no action needed
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[Razorpay webhook error]", err.message);
    res.status(500).json({ message: "Webhook processing failed." });
  }
};

// ── GET /api/razorpay/config ──────────────────────────────────────────────────
const getConfig = (req, res) => {
  res.json({ success: true, keyId: process.env.RAZORPAY_KEY_ID });
};

// ── GET /api/razorpay/health ──────────────────────────────────────────────────
// Verifies Razorpay credentials are correctly set by making a test API call
const healthCheck = async (req, res) => {
  try {
    const plans = await getRazorpay().plans.all({ count: 1 });
    res.json({
      success: true,
      message: "Razorpay credentials are valid.",
      keyId: process.env.RAZORPAY_KEY_ID,
      planBasic: process.env.RAZORPAY_PLAN_BASIC || "NOT SET",
      planPro: process.env.RAZORPAY_PLAN_PRO || "NOT SET",
      planEnterprise: process.env.RAZORPAY_PLAN_ENTERPRISE || "NOT SET",
    });
  } catch (e) {
    const detail = e?.error?.description || e?.message || "Unknown error";
    res.status(400).json({
      success: false,
      message: `Razorpay credentials invalid: ${detail}`,
      keyId: process.env.RAZORPAY_KEY_ID || "NOT SET",
    });
  }
};

module.exports = { createSubscription, verifyAndSignup, activateSubscription, webhook, getConfig, healthCheck };
