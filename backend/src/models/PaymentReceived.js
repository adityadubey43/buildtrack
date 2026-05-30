const mongoose = require("mongoose");

const paymentReceivedSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    clientName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    paymentMode: {
      type: String,
      enum: ["cash", "bank", "upi", "cheque", "razorpay"],
      default: "bank",
    },
    reference: { type: String },
    milestone: { type: String },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    notes: { type: String },
    attachments: [{ url: String, name: String }],
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

paymentReceivedSchema.index({ tenantId: 1, project: 1, date: -1 });

module.exports = mongoose.model("PaymentReceived", paymentReceivedSchema);
