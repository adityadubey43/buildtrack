const mongoose = require("mongoose");

const phaseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  completionPct: { type: Number, default: 0, min: 0, max: 100 },
  startDate: { type: Date },
  endDate: { type: Date },
  isCompleted: { type: Boolean, default: false },
});

const milestoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dueDate: { type: Date },
  completionPct: { type: Number, default: 0 },
  billingAmount: { type: Number, default: 0 },
  isBilled: { type: Boolean, default: false },
  isPaid: { type: Boolean, default: false },
});

const projectSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    clientName: { type: String },
    clientPhone: { type: String },
    budget: { type: Number, required: true },
    amountSpent: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    currentPhase: { type: String, default: "Planning" },
    phases: [phaseSchema],
    milestones: [milestoneSchema],
    overallProgress: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["planning", "active", "on-hold", "completed", "cancelled"],
      default: "active",
    },
    assignedEngineers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    assignedSupervisors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    images: [{ url: String, caption: String, uploadedAt: Date }],
    documents: [{ name: String, url: String, type: String, uploadedAt: Date }],
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
