const mongoose = require("mongoose");

const vendorBillSchema = new mongoose.Schema(
  {
    tenantId:    { type: String, required: true, index: true },
    vendorId:    { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    amount:      { type: Number, required: true, min: 0 },
    date:        { type: Date, required: true, default: Date.now },
    description: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true },
    project:     { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    notes:       { type: String, trim: true },
    recordedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

vendorBillSchema.index({ tenantId: 1, vendorId: 1, date: -1 });

module.exports = mongoose.model("VendorBill", vendorBillSchema);
