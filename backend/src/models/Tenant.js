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
    razorpaySubscriptionId: { type: String, index: true, sparse: true },
    subscriptionStartedAt: { type: Date },   // when planStatus became "active"
    subscriptionEndsAt:    { type: Date },   // null = monthly (Razorpay handles), date = yearly renewal
    // ✅ IMMUTABLE: Price they actually signed up at — never changes even if platform pricing updates
    subscriptionPrice: {
      amount: { type: Number },              // actual amount they pay (monthly or yearly)
      billing: { type: String, enum: ["monthly", "yearly"] }, // billing frequency
      capturedAt: { type: Date },            // when price was locked in
    },
    logo: { type: String },
    isActive: { type: Boolean, default: true },

    // Invoice / company profile for GST invoices
    invoiceSettings: {
      email: { type: String },
      pan: { type: String },
      stateCode: { type: String }, // 2-digit GST state code, e.g. "27" for Maharashtra
      bankName: { type: String },
      accountNumber: { type: String },
      ifsc: { type: String },
      accountHolder: { type: String },
      upiId: { type: String },
      logo: { type: String },      // base64 data URL or hosted URL for invoice header
      signature: { type: String }, // base64 data URL or hosted URL
      defaultTerms: { type: String },
      defaultPaymentInstructions: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tenant", tenantSchema);
