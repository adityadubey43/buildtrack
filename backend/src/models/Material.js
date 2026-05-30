const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["cement", "steel", "sand", "aggregate", "bricks", "wood", "electrical", "plumbing", "finishing", "other"],
      default: "other",
    },
    unit: { type: String, required: true },
    currentStock: { type: Number, default: 0 },
    minimumStock: { type: Number, default: 0 },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    vendor: { type: String },
    vendorPhone: { type: String },
    lastPurchasePrice: { type: Number, default: 0 },
    lastOrderDate: { type: Date },
    onOrder: { type: Number, default: 0 },
    stockAlertSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const materialTransactionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true },
    material: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    type: { type: String, enum: ["purchase", "usage", "return", "transfer"], required: true },
    quantity: { type: Number, required: true },
    unit: { type: String },
    rate: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    vendor: { type: String },
    invoiceNumber: { type: String },
    date: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
  },
  { timestamps: true }
);

const Material = mongoose.model("Material", materialSchema);
const MaterialTransaction = mongoose.model("MaterialTransaction", materialTransactionSchema);

module.exports = { Material, MaterialTransaction };
