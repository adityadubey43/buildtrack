const mongoose = require("mongoose");

// Single-document config store for platform-wide settings.
// We always upsert with key="main" so there's exactly one doc.
const platformConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    pricing: {
      basic:          { type: Number, default: 999 },
      pro:            { type: Number, default: 2499 },
      enterprise:     { type: Number, default: 4999 },
      yearlyDiscount: { type: Number, default: 10 }, // percent
    },
    // Razorpay plan IDs — auto-created when pricing is saved
    razorpayPlanIds: {
      basic:      { type: String, default: "" },
      pro:        { type: String, default: "" },
      enterprise: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformConfig", platformConfigSchema);
