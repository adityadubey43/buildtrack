const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true },
    // URL-friendly handle used for the per-company login page: /c/<slug>
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    companyName: { type: String, required: true, trim: true },
    phone: { type: String },
    address: { type: String },
    gstNumber: { type: String },
    plan: {
      type: String,
      enum: ["basic", "pro", "enterprise"],
      default: "pro",
    },
    planStatus: {
      type: String,
      enum: ["trial", "active", "expired", "cancelled"],
      default: "trial",
    },
    trialEndsAt: { type: Date },
    subscriptionId: { type: String },
    logo: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tenant", tenantSchema);
