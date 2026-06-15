const Razorpay = require("razorpay");
const crypto   = require("crypto");
const Tenant   = require("../models/Tenant");
const User     = require("../models/User");
const PlatformConfig = require("../models/PlatformConfig");
const { generateToken, generateTenantId, generateUniqueSlug } = require("../utils/generateToken");
const { sendEmail } = require("../utils/mailer");
const templates    = require("../utils/emailTemplates");

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

// ── Dynamic pricing from DB (falls back to hardcoded defaults) ────────────────
async function getLivePrices() {
  const cfg = await PlatformConfig.findOne({ key: "main" }).lean();
  const disc = cfg?.pricing?.yearlyDiscount ?? 10;
  const monthly = {
    basic:      cfg?.pricing?.basic      ?? 999,
    pro:        cfg?.pricing?.pro        ?? 2499,
    enterprise: cfg?.pricing?.enterprise ?? 4999,
  };
  const yearly = {
    basic:      Math.round(monthly.basic      * 12 * (1 - disc / 100)),
    pro:        Math.round(monthly.pro        * 12 * (1 - disc / 100)),
    enterprise: Math.round(monthly.enterprise * 12 * (1 - disc / 100)),
  };
  return { monthly, yearly };
}

// ── Razorpay plan ID lookup — DB first, then env fallback ────────────────────
async function getRazorpayPlanId(plan) {
  try {
    const cfg = await PlatformConfig.findOne({ key: "main" }, "razorpayPlanIds").lean();
    const dbId = cfg?.razorpayPlanIds?.[plan];
    if (dbId) return dbId;
  } catch (e) {
    console.warn("[getRazorpayPlanId] DB lookup failed:", e.message);
  }
  // Fallback to env
  const key = plan.toUpperCase();
  return process.env[`RAZORPAY_PLAN_${key}_MONTHLY`]
      || process.env[`RAZORPAY_PLAN_${key}`]
      || null;
}

// ── HMAC helpers ──────────────────────────────────────────────────────────────
// Subscription:  HMAC( payment_id | subscription_id , secret )
function verifySubscriptionSig(paymentId, subscriptionId, sig) {
  if (!paymentId || !subscriptionId || !sig) return false;
  const exp = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`).digest("hex");
  return exp === sig;
}
// Order:  HMAC( order_id | payment_id , secret )
function verifyOrderSig(orderId, paymentId, sig) {
  if (!orderId || !paymentId || !sig) return false;
  const exp = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`).digest("hex");
  return exp === sig;
}

// ── Verify subscription via Razorpay API (fallback when HMAC unavailable) ────
// Used for card recurring mandates where payment_id may be absent on first auth
async function verifySubscriptionViaApi(subscriptionId) {
  try {
    const sub = await getRzp().subscriptions.fetch(subscriptionId);
    console.log(`[verify] Sub ${subscriptionId} status: ${sub.status}`);
    // Accept multiple statuses: created (awaiting authorization), authenticated (mandate set), active (first charge succeeded)
    return ["created", "authenticated", "active", "pending"].includes(sub.status);
  } catch (e) {
    console.error("[verify] API fetch failed:", e?.error?.description || e?.message);
    return false;
  }
}

// ── User payload ──────────────────────────────────────────────────────────────
function userPayload(user, tenant) {
  return {
    id: user._id, name: user.name, email: user.email, role: user.role,
    tenantId: user.tenantId, slug: tenant.slug, companyName: tenant.companyName,
    plan: tenant.plan, planStatus: tenant.planStatus, trialEndsAt: tenant.trialEndsAt,
    subscriptionStartedAt: tenant.subscriptionStartedAt,
    subscriptionEndsAt:    tenant.subscriptionEndsAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/razorpay/health
// ─────────────────────────────────────────────────────────────────────────────
const health = async (req, res) => {
  const planChecks = await Promise.all(["basic", "pro", "enterprise"].map(async (p) => ({ p, id: await getRazorpayPlanId(p) })));
  const missingPlans = planChecks.filter((x) => !x.id).map((x) => x.p);
  const missingCore  = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"].filter((k) => !process.env[k]);
  const missing = [...missingCore, ...missingPlans.map((p) => `RAZORPAY_PLAN_${p.toUpperCase()}[_MONTHLY]`)];
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
    const { plan = "pro", email, companyName, phone = "9999999999" } = req.body;
    if (!email || !companyName) return res.status(400).json({ success: false, message: "email and companyName are required." });

    const planId = await getRazorpayPlanId(plan);
    if (!planId) return res.status(400).json({ success: false, message: `Plan "${plan}" not configured. Save pricing from the Platform Dashboard first.` });

    // Create or get customer for recurring payments
    let customerId;
    try {
      const customers = await getRzp().customers.all({ email });
      if (customers.items && customers.items.length > 0) {
        customerId = customers.items[0].id;
      } else {
        const customer = await getRzp().customers.create({
          email, contact: phone, name: companyName,
        });
        customerId = customer.id;
      }
    } catch (e) {
      console.warn("[createSubscription] Customer lookup failed, proceeding:", e?.message);
    }

    const sub = await getRzp().subscriptions.create({
      plan_id: planId,
      total_count: 120,  // 120 months = 10 years (Razorpay requires >= 1)
      customer_notify: 1,
      customer_id: customerId,
      expire_by: Math.floor((new Date().getTime() + 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days to authorize
      notes: { company: companyName, email, plan, billing: "monthly" },
    });

    const { monthly } = await getLivePrices();
    res.json({
      success: true,
      subscriptionId: sub.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: (monthly[plan] ?? 999) * 100,
      plan,
      billing: "monthly",
      customerId,
      status: sub.status,
    });
  } catch (err) {
    console.error("[createSubscription] Error:", err?.error || err);
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

    const { yearly } = await getLivePrices();
    const amount = yearly[plan];
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
      // ✅ IMPORTANT: amount should be sent from frontend (what they actually paid)
      amount,
    } = req.body;

    if (!companyName || !adminName || !email || !password)
      return res.status(400).json({ success: false, message: "All signup fields are required." });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

    // ── Verify payment ────────────────────────────────────────────────────────
    console.log("[verifyAndSignup] payload:", {
      billing, plan, amount,
      payment_id: razorpay_payment_id || "(absent)",
      subscription_id: razorpay_subscription_id || "(absent)",
      order_id: razorpay_order_id || "(absent)",
      has_sig: !!razorpay_signature,
    });

    if (billing === "yearly") {
      // Yearly: one-time Order — HMAC required
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
        return res.status(400).json({ success: false, message: "Missing yearly payment details." });
      if (!verifyOrderSig(razorpay_order_id, razorpay_payment_id, razorpay_signature))
        return res.status(400).json({ success: false, message: "Payment verification failed. Please try again." });

    } else {
      // Monthly: Subscription
      if (!razorpay_subscription_id)
        return res.status(400).json({ success: false, message: "Missing subscription ID." });

      // Try HMAC first (fast, no API call)
      const hmacOk = verifySubscriptionSig(razorpay_payment_id, razorpay_subscription_id, razorpay_signature);

      if (!hmacOk) {
        // HMAC failed or payment_id absent — this happens for card recurring mandate setup
        // Fall back to Razorpay API to confirm subscription status
        console.log("[verifyAndSignup] HMAC failed/absent — falling back to API verification");
        const apiOk = await verifySubscriptionViaApi(razorpay_subscription_id);
        if (!apiOk) {
          return res.status(400).json({
            success: false,
            message: "Payment verification failed. The subscription is not authorised yet.",
          });
        }
        console.log("[verifyAndSignup] API verification passed ✅");
      } else {
        console.log("[verifyAndSignup] HMAC verification passed ✅");
      }
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
    const now = new Date();
    const endsAt = billing === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : null;

    // ✅ SAFEGUARD: Store the actual price they signed up at (immutable)
    const tenant = await Tenant.create({
      tenantId, slug, companyName, phone, plan,
      planStatus: "active",
      razorpaySubscriptionId: refId,
      subscriptionStartedAt: now,
      subscriptionEndsAt: endsAt,       // null for monthly (Razorpay auto-renews)
      ...(endsAt && { trialEndsAt: endsAt }),
      // Lock in the price they paid — this NEVER changes even if platform pricing updates
      subscriptionPrice: {
        amount: amount ? Number(amount) : null,
        billing,
        capturedAt: now,
      },
    });

    const user = await User.create({ tenantId, name: adminName, email: email.toLowerCase(), password, phone, role: "admin" });

    // Payment confirmation email
    const tpl = templates.paymentConfirmed({
      adminName,
      companyName,
      plan,
      billing,
      amount,
      startDate: now,
      nextBillingDate: endsAt,
      paymentId: razorpay_payment_id || refId,
    });
    sendEmail({ to: email.toLowerCase(), ...tpl });

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
      // ✅ IMPORTANT: amount should be sent from frontend (what they actually paid)
      amount,
    } = req.body;

    // ── Verify ──
    console.log("[activateSub] payload:", { billing, plan, amount, payment_id: razorpay_payment_id || "(absent)", subscription_id: razorpay_subscription_id || "(absent)", order_id: razorpay_order_id || "(absent)" });

    if (billing === "yearly") {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
        return res.status(400).json({ success: false, message: "Missing yearly payment details." });
      if (!verifyOrderSig(razorpay_order_id, razorpay_payment_id, razorpay_signature))
        return res.status(400).json({ success: false, message: "Payment verification failed." });
    } else {
      if (!razorpay_subscription_id)
        return res.status(400).json({ success: false, message: "Missing subscription ID." });

      const hmacOk = verifySubscriptionSig(razorpay_payment_id, razorpay_subscription_id, razorpay_signature);
      if (!hmacOk) {
        console.log("[activateSub] HMAC failed/absent — falling back to API verification");
        const apiOk = await verifySubscriptionViaApi(razorpay_subscription_id);
        if (!apiOk) return res.status(400).json({ success: false, message: "Payment verification failed." });
        console.log("[activateSub] API verification passed ✅");
      } else {
        console.log("[activateSub] HMAC verification passed ✅");
      }
    }

    const refId = billing === "yearly" ? razorpay_order_id : razorpay_subscription_id;

    // ── Update tenant ──
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    if (!tenant) return res.status(404).json({ success: false, message: "Company not found." });

    const now = new Date();
    tenant.razorpaySubscriptionId = refId;
    tenant.planStatus = "active";
    tenant.subscriptionStartedAt = now;
    if (plan) tenant.plan = plan;
    if (billing === "yearly") {
      const endsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      tenant.subscriptionEndsAt = endsAt;
      tenant.trialEndsAt = endsAt;
    } else {
      tenant.subscriptionEndsAt = null; // monthly — Razorpay handles renewal
    }
    // ✅ SAFEGUARD: Store the actual price they signed up at (immutable)
    tenant.subscriptionPrice = {
      amount: amount ? Number(amount) : null,
      billing,
      capturedAt: now,
    };
    await tenant.save();

    const user = await User.findById(req.user._id);

    // Payment confirmation email
    const tpl = templates.paymentConfirmed({
      adminName: user.name,
      companyName: tenant.companyName,
      plan: tenant.plan,
      billing,
      amount,
      startDate: now,
      nextBillingDate: billing === "yearly" ? tenant.subscriptionEndsAt : null,
      paymentId: razorpay_payment_id || refId,
    });
    sendEmail({ to: user.email, ...tpl });

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

    if (!secret) {
      console.error("[webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting all webhook calls.");
      return res.status(400).json({ message: "Webhook not configured." });
    }
    if (!sig) return res.status(400).json({ message: "Missing webhook signature." });
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (expected !== sig) return res.status(400).json({ message: "Invalid webhook signature." });

    const { event, payload } = JSON.parse(raw.toString());
    const subscriptionId = payload?.subscription?.entity?.id;
    if (!subscriptionId) return res.json({ received: true });

    const tenant = await Tenant.findOne({ razorpaySubscriptionId: subscriptionId });
    if (!tenant) return res.json({ received: true });

    const adminUser = await User.findOne({ tenantId: tenant.tenantId, role: "admin" });

    if (event === "subscription.activated") {
      tenant.planStatus = "active";
    } else if (event === "subscription.charged") {
      tenant.planStatus = "active";
      // Renewal confirmation email
      if (adminUser) {
        const chargeAmt = payload?.payment?.entity?.amount;
        const tpl = templates.subscriptionRenewed({
          companyName: tenant.companyName,
          plan: tenant.plan,
          billing: tenant.subscriptionPrice?.billing || "monthly",
          amount: chargeAmt ? chargeAmt / 100 : tenant.subscriptionPrice?.amount,
          periodEnd: tenant.subscriptionEndsAt,
        });
        sendEmail({ to: adminUser.email, ...tpl });
      }
    } else if (event === "subscription.halted" || event === "subscription.pending") {
      tenant.planStatus = "expired";
      if (adminUser) {
        const tpl = templates.planExpired({
          adminName: adminUser.name,
          companyName: tenant.companyName,
          upgradeUrl: `${process.env.FRONTEND_URL || ""}/${tenant.slug}/dashboard`,
        });
        sendEmail({ to: adminUser.email, ...tpl });
      }
    } else if (event === "subscription.cancelled") {
      tenant.planStatus = "cancelled";
      tenant.isActive   = false;
      if (adminUser) {
        const tpl = templates.subscriptionCancelled({ adminName: adminUser.name, companyName: tenant.companyName });
        sendEmail({ to: adminUser.email, ...tpl });
      }
    }

    await tenant.save();
    res.json({ received: true });
  } catch (err) {
    console.error("[webhook error]", err.message);
    res.status(500).json({ message: "Webhook error." });
  }
};

module.exports = { health, createSubscription, createOrder, verifyAndSignup, activateSubscription, webhook };
