/**
 * One-time setup: creates monthly subscription plans in Razorpay and
 * prints the plan IDs you must add to your .env file.
 *
 * Usage:
 *   node scripts/createRazorpayPlans.js
 *
 * Prerequisites:
 *   - RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET set in .env
 */
require("dotenv").config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLANS = [
  {
    envKey: "RAZORPAY_PLAN_BASIC",
    body: {
      period: "monthly",
      interval: 1,
      item: {
        name: "BuildTrack Basic",
        amount: 99900, // ₹999 in paise
        currency: "INR",
        description: "BuildTrack Basic Plan — up to 3 projects, 25 workers",
      },
      notes: { plan: "basic" },
    },
  },
  {
    envKey: "RAZORPAY_PLAN_PRO",
    body: {
      period: "monthly",
      interval: 1,
      item: {
        name: "BuildTrack Pro",
        amount: 249900, // ₹2,499 in paise
        currency: "INR",
        description: "BuildTrack Pro Plan — unlimited projects & workers",
      },
      notes: { plan: "pro" },
    },
  },
  {
    envKey: "RAZORPAY_PLAN_ENTERPRISE",
    body: {
      period: "monthly",
      interval: 1,
      item: {
        name: "BuildTrack Enterprise",
        amount: 499900, // ₹4,999 in paise
        currency: "INR",
        description: "BuildTrack Enterprise Plan — large firms, custom SLA",
      },
      notes: { plan: "enterprise" },
    },
  },
];

(async () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env");
    process.exit(1);
  }

  console.log("Creating Razorpay subscription plans...\n");

  const lines = [];
  for (const plan of PLANS) {
    try {
      const created = await razorpay.plans.create(plan.body);
      const line = `${plan.envKey}=${created.id}`;
      lines.push(line);
      console.log(`✅ ${plan.body.item.name}`);
      console.log(`   Plan ID : ${created.id}`);
      console.log(`   Amount  : ₹${plan.body.item.amount / 100}/month`);
      console.log();
    } catch (err) {
      console.error(`❌ Failed to create ${plan.body.item.name}:`, err.error?.description || err.message);
    }
  }

  if (lines.length) {
    console.log("─────────────────────────────────────────────");
    console.log("Add these lines to your .env file:\n");
    lines.forEach((l) => console.log(l));
    console.log("\nThen restart the backend server.");
  }
})();
