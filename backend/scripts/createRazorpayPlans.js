/**
 * One-time setup: creates monthly + yearly subscription plans in Razorpay.
 * Yearly plans have a 10% discount baked into the amount.
 *
 * Usage: node scripts/createRazorpayPlans.js
 */
require("dotenv").config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Monthly prices in ₹
const MONTHLY = { basic: 999, pro: 2499, enterprise: 4999 };

// Yearly = monthly × 12 × 0.9 (10% off), rounded to nearest rupee
const yearly = (monthly) => Math.round(monthly * 12 * 0.9);

const PLANS = [
  // ── Monthly ──────────────────────────────────────────────────────────────
  {
    envKey: "RAZORPAY_PLAN_BASIC_MONTHLY",
    body: {
      period: "monthly", interval: 1,
      item: { name: "BuildTrack Basic (Monthly)", amount: MONTHLY.basic * 100, currency: "INR", description: "Up to 3 projects, 25 workers — billed monthly" },
      notes: { plan: "basic", billing: "monthly" },
    },
  },
  {
    envKey: "RAZORPAY_PLAN_PRO_MONTHLY",
    body: {
      period: "monthly", interval: 1,
      item: { name: "BuildTrack Pro (Monthly)", amount: MONTHLY.pro * 100, currency: "INR", description: "Unlimited projects & workers — billed monthly" },
      notes: { plan: "pro", billing: "monthly" },
    },
  },
  {
    envKey: "RAZORPAY_PLAN_ENTERPRISE_MONTHLY",
    body: {
      period: "monthly", interval: 1,
      item: { name: "BuildTrack Enterprise (Monthly)", amount: MONTHLY.enterprise * 100, currency: "INR", description: "Large firms, custom SLA — billed monthly" },
      notes: { plan: "enterprise", billing: "monthly" },
    },
  },

  // ── Yearly (10% off, billed as one annual charge) ─────────────────────
  {
    envKey: "RAZORPAY_PLAN_BASIC_YEARLY",
    body: {
      period: "yearly", interval: 1,
      item: { name: "BuildTrack Basic (Yearly)", amount: yearly(MONTHLY.basic) * 100, currency: "INR", description: `Up to 3 projects, 25 workers — ₹${yearly(MONTHLY.basic)}/year (10% off)` },
      notes: { plan: "basic", billing: "yearly" },
    },
  },
  {
    envKey: "RAZORPAY_PLAN_PRO_YEARLY",
    body: {
      period: "yearly", interval: 1,
      item: { name: "BuildTrack Pro (Yearly)", amount: yearly(MONTHLY.pro) * 100, currency: "INR", description: `Unlimited projects & workers — ₹${yearly(MONTHLY.pro)}/year (10% off)` },
      notes: { plan: "pro", billing: "yearly" },
    },
  },
  {
    envKey: "RAZORPAY_PLAN_ENTERPRISE_YEARLY",
    body: {
      period: "yearly", interval: 1,
      item: { name: "BuildTrack Enterprise (Yearly)", amount: yearly(MONTHLY.enterprise) * 100, currency: "INR", description: `Large firms, custom SLA — ₹${yearly(MONTHLY.enterprise)}/year (10% off)` },
      notes: { plan: "enterprise", billing: "yearly" },
    },
  },
];

(async () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env");
    process.exit(1);
  }

  console.log(`Creating Razorpay plans (${process.env.RAZORPAY_KEY_ID.startsWith("rzp_live") ? "LIVE" : "TEST"} mode)...\n`);

  const lines = [];
  for (const plan of PLANS) {
    try {
      const created = await razorpay.plans.create(plan.body);
      lines.push(`${plan.envKey}=${created.id}`);
      console.log(`✅ ${plan.body.item.name}`);
      console.log(`   Plan ID : ${created.id}`);
      console.log(`   Amount  : ₹${plan.body.item.amount / 100}/${plan.body.period}`);
      console.log();
    } catch (err) {
      console.error(`❌ Failed to create ${plan.body.item.name}:`, err.error?.description || err.message);
    }
  }

  if (lines.length) {
    console.log("─────────────────────────────────────────────");
    console.log("Add these lines to your .env:\n");
    lines.forEach((l) => console.log(l));
    console.log("\nThen restart the backend server.");
  }
})();
