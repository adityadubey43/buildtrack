/**
 * Creates (or recreates) Razorpay subscription plans using the current
 * pricing stored in PlatformConfig (set via the platform dashboard).
 *
 * Falls back to env vars PLAN_PRICE_BASIC / PLAN_PRICE_PRO / PLAN_PRICE_ENTERPRISE
 * if no DB config exists, then to hardcoded defaults (999 / 2499 / 4999).
 *
 * Usage:
 *   node scripts/createRazorpayPlans.js
 *
 * After running, copy the printed env lines into your .env and restart the backend.
 */
require("dotenv").config();
const Razorpay  = require("razorpay");
const mongoose  = require("mongoose");

async function getPrices() {
  // Try DB first
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const PlatformConfig = require("../src/models/PlatformConfig");
    const cfg = await PlatformConfig.findOne({ key: "main" }).lean();
    await mongoose.disconnect();
    if (cfg?.pricing) {
      console.log("✔  Prices loaded from PlatformConfig (MongoDB)\n");
      return {
        basic:          cfg.pricing.basic,
        pro:            cfg.pricing.pro,
        enterprise:     cfg.pricing.enterprise,
        yearlyDiscount: cfg.pricing.yearlyDiscount ?? 10,
      };
    }
  } catch (e) {
    console.warn("⚠  Could not read DB pricing:", e.message, "— falling back to env/defaults\n");
  }

  // Fall back to env vars or hardcoded defaults
  return {
    basic:          Number(process.env.PLAN_PRICE_BASIC)      || 999,
    pro:            Number(process.env.PLAN_PRICE_PRO)        || 2499,
    enterprise:     Number(process.env.PLAN_PRICE_ENTERPRISE) || 4999,
    yearlyDiscount: Number(process.env.PLAN_YEARLY_DISCOUNT)  || 10,
  };
}

(async () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌  RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env");
    process.exit(1);
  }

  const { basic, pro, enterprise, yearlyDiscount } = await getPrices();
  const disc = yearlyDiscount / 100;

  const MONTHLY = { basic, pro, enterprise };
  const YEARLY  = {
    basic:      Math.round(basic      * 12 * (1 - disc)),
    pro:        Math.round(pro        * 12 * (1 - disc)),
    enterprise: Math.round(enterprise * 12 * (1 - disc)),
  };

  console.log(`Prices to use:`);
  console.log(`  Basic:      ₹${basic}/mo  · ₹${YEARLY.basic}/yr`);
  console.log(`  Pro:        ₹${pro}/mo  · ₹${YEARLY.pro}/yr`);
  console.log(`  Enterprise: ₹${enterprise}/mo  · ₹${YEARLY.enterprise}/yr`);
  console.log(`  Yearly discount: ${yearlyDiscount}%\n`);

  const rzp = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const mode = process.env.RAZORPAY_KEY_ID.startsWith("rzp_live") ? "LIVE" : "TEST";
  console.log(`Creating Razorpay plans (${mode} mode)...\n`);

  const PLANS = [
    {
      envKey: "RAZORPAY_PLAN_BASIC",
      body: {
        period: "monthly", interval: 1,
        item: { name: "BuildTrack Basic (Monthly)", amount: MONTHLY.basic * 100, currency: "INR",
                description: `Up to 3 projects, 25 workers — ₹${MONTHLY.basic}/month` },
        notes: { plan: "basic", billing: "monthly" },
      },
    },
    {
      envKey: "RAZORPAY_PLAN_PRO",
      body: {
        period: "monthly", interval: 1,
        item: { name: "BuildTrack Pro (Monthly)", amount: MONTHLY.pro * 100, currency: "INR",
                description: `Unlimited projects & workers — ₹${MONTHLY.pro}/month` },
        notes: { plan: "pro", billing: "monthly" },
      },
    },
    {
      envKey: "RAZORPAY_PLAN_ENTERPRISE",
      body: {
        period: "monthly", interval: 1,
        item: { name: "BuildTrack Enterprise (Monthly)", amount: MONTHLY.enterprise * 100, currency: "INR",
                description: `Large firms, custom SLA — ₹${MONTHLY.enterprise}/month` },
        notes: { plan: "enterprise", billing: "monthly" },
      },
    },
  ];

  const lines = [];
  for (const plan of PLANS) {
    try {
      const created = await rzp.plans.create(plan.body);
      lines.push(`${plan.envKey}=${created.id}`);
      console.log(`✅  ${plan.body.item.name}`);
      console.log(`    Plan ID : ${created.id}`);
      console.log(`    Amount  : ₹${plan.body.item.amount / 100}/month\n`);
    } catch (err) {
      console.error(`❌  Failed to create ${plan.body.item.name}:`, err.error?.description || err.message);
    }
  }

  if (lines.length) {
    console.log("─────────────────────────────────────────────────────");
    console.log("Copy these into your .env and restart the backend:\n");
    lines.forEach((l) => console.log(l));
    console.log("\n─────────────────────────────────────────────────────");
  }
})();
