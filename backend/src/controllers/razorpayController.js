const Razorpay = require("razorpay");
const crypto = require("crypto");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const { generateToken, generateTenantId, generateUniqueSlug } = require("../utils/generateToken");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

    // start_at = Unix timestamp 7 days from now (trial period)
    const startAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 120, // 10 years max billing cycles
      quantity: 1,
      start_at: startAt,
      customer_notify: 1,
      notes: {
        company: companyName,
        email,
        plan,
      },
    });

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
// We verify the signature, then create the Tenant + admin User in one transaction.
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

    // ── Verify Razorpay signature ──
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Please contact support." });
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
      planStatus: "trial",
      trialEndsAt,
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
// Returns the publishable key so the frontend doesn't need it in .env
const getConfig = (req, res) => {
  res.json({ success: true, keyId: process.env.RAZORPAY_KEY_ID });
};

module.exports = { createSubscription, verifyAndSignup, webhook, getConfig };
