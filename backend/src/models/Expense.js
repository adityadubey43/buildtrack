const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    type: {
      type: String,
      enum: ["labour", "material", "miscellaneous", "travel"],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    vendor: { type: String },
    invoiceNumber: { type: String },
    paymentMode: {
      type: String,
      enum: ["cash", "bank", "upi", "cheque"],
      default: "cash",
    },
    attachments: [{ url: String, name: String }],
    notes: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

expenseSchema.index({ tenantId: 1, project: 1, date: -1 });
expenseSchema.index({ tenantId: 1, type: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
