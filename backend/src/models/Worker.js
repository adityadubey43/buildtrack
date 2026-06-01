const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    // Links this worker record to a login User (set for staff who mark their own attendance)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    // High-level classification used to separate attendance & payroll flows
    workerType: {
      type: String,
      enum: ["labour", "employee"],
      default: "labour",
      index: true,
    },
    role: {
      type: String,
      enum: ["labour", "mason", "helper", "contractor", "electrician", "plumber", "engineer", "supervisor", "accountant", "office-staff", "other"],
      required: true,
    },
    wageType: {
      type: String,
      enum: ["daily", "contract", "monthly"],
      default: "daily",
    },
    dailyWage: { type: Number, default: 0 },
    monthlySalary: { type: Number, default: 0 },
    contractAmount: { type: Number, default: 0 },
    assignedSite: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    idProof: { type: String },
    photo: { type: String },
    isActive: { type: Boolean, default: true },
    joiningDate: { type: Date, default: Date.now },
    bankAccount: { type: String },
    ifscCode: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Worker", workerSchema);
