const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hsnCode: { type: String },
  unit: { type: String, default: "nos" }, // sqft, rft, nos, ls, rm, kg, etc.
  quantity: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true }, // qty * rate
  gstRate: { type: Number, default: 18, enum: [0, 5, 12, 18, 28] },
});

const additionalChargeSchema = new mongoose.Schema({
  label: { type: String, required: true },
  amount: { type: Number, required: true },
});

const paymentRecordSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  mode: {
    type: String,
    enum: ["cash", "bank", "upi", "cheque", "razorpay"],
    default: "bank",
  },
  reference: { type: String },
  notes: { type: String },
});

const taxLineSchema = new mongoose.Schema({
  gstRate: { type: Number },
  taxableAmount: { type: Number },
  cgstRate: { type: Number },
  cgstAmount: { type: Number },
  sgstRate: { type: Number },
  sgstAmount: { type: Number },
  igstRate: { type: Number },
  igstAmount: { type: Number },
});

const invoiceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },

    // Company snapshot (filled from Tenant at creation time)
    company: {
      name: { type: String },
      address: { type: String },
      gstin: { type: String },
      stateCode: { type: String },
      phone: { type: String },
      email: { type: String },
      logo: { type: String },
      bankName: { type: String },
      accountNumber: { type: String },
      ifsc: { type: String },
      accountHolder: { type: String },
      upiId: { type: String },
      signature: { type: String },
      pan: { type: String },
    },

    // Client
    client: {
      name: { type: String, required: true },
      address: { type: String },
      gstin: { type: String },
      stateCode: { type: String },
      phone: { type: String },
      email: { type: String },
    },

    // Invoice meta
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date },

    // Project
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    projectName: { type: String },
    siteName: { type: String },
    siteLocation: { type: String },
    workType: {
      type: String,
      enum: ["labour", "material", "turnkey", "pmc", "supply", "other"],
      default: "other",
    },

    // Line items
    items: [itemSchema],

    // Calculated fields
    subtotal: { type: Number, default: 0 },

    // Discount
    discountType: { type: String, enum: ["none", "pct", "fixed"], default: "none" },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },

    // After discount
    taxableAmount: { type: Number, default: 0 },

    // GST — auto-detected from GSTIN state codes
    gstType: { type: String, enum: ["intra", "inter"], default: "intra" },
    // Tax breakdown stored as array (one entry per rate group)
    taxLines: [taxLineSchema],
    totalTax: { type: Number, default: 0 },

    // Additional charges
    additionalCharges: [additionalChargeSchema],
    additionalChargesTotal: { type: Number, default: 0 },

    // TDS
    tdsRate: { type: Number, default: 0 },
    tdsAmount: { type: Number, default: 0 },

    // Options
    reverseCharge: { type: Boolean, default: false },
    roundOff: { type: Number, default: 0 },

    // Final
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },

    // Status
    status: {
      type: String,
      enum: ["draft", "sent", "partially-paid", "paid", "overdue", "cancelled"],
      default: "draft",
    },

    // Payment records
    payments: [paymentRecordSchema],

    // Recurring
    recurring: {
      type: {
        type: String,
        enum: ["one-time", "weekly", "monthly", "milestone"],
        default: "one-time",
      },
      milestone: { type: String },
      nextDueDate: { type: Date },
    },

    // Backward-compat aliases (kept for existing data / old code paths)
    milestone: { type: String },   // alias of recurring.milestone
    gstRate: { type: Number, default: 18 }, // backward-compat single-rate field

    // Content
    terms: { type: String },
    notes: { type: String },
    paymentInstructions: { type: String },

    // Attachments
    attachments: [{ name: String, url: String, type: String }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
