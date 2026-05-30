const mongoose = require("mongoose");

const payrollEntrySchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  daysWorked: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  presentDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  leaveDays: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  dailyWage: { type: Number, default: 0 },
  monthlySalary: { type: Number, default: 0 },
  basicAmount: { type: Number, default: 0 },
  overtimeAmount: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "paid"], default: "pending" },
  paidOn: { type: Date },
  paymentMode: { type: String, enum: ["cash", "bank", "upi"], default: "cash" },
  transactionRef: { type: String },
});

const payrollSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    // labour → weekly (default), employee → monthly (default)
    workerType: { type: String, enum: ["labour", "employee"], default: "labour" },
    cycle: { type: String, enum: ["weekly", "monthly", "custom"], default: "weekly" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    weekStartDate: { type: Date, required: true }, // period start
    weekEndDate: { type: Date, required: true }, // period end
    weekLabel: { type: String }, // period label
    entries: [payrollEntrySchema],
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "calculated", "partially-paid", "paid"],
      default: "calculated",
    },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payroll", payrollSchema);
