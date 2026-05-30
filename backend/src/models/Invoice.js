const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true },
});

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  mode: { type: String, enum: ["cash", "cheque", "bank", "upi", "razorpay"], default: "bank" },
  reference: { type: String },
  notes: { type: String },
});

const invoiceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    clientName: { type: String, required: true },
    clientAddress: { type: String },
    clientGST: { type: String },
    milestone: { type: String },
    items: [invoiceItemSchema],
    subtotal: { type: Number, required: true },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "sent", "partially-paid", "paid", "overdue", "cancelled"],
      default: "draft",
    },
    payments: [paymentSchema],
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
