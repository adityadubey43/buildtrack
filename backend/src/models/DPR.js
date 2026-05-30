const mongoose = require("mongoose");

const dprSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    date: { type: Date, required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workActivity: { type: String, required: true },
    workDescription: { type: String },
    workersPresent: { type: Number, default: 0 },
    weather: {
      type: String,
      enum: ["sunny", "cloudy", "rainy", "windy", "foggy"],
      default: "sunny",
    },
    images: [
      {
        url: { type: String },
        caption: { type: String },
        type: { type: String, enum: ["before", "after", "progress", "other"], default: "progress" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    hasDelay: { type: Boolean, default: false },
    delayReason: { type: String },
    delayHours: { type: Number, default: 0 },
    materialsUsed: [
      {
        name: { type: String },
        quantity: { type: Number },
        unit: { type: String },
      },
    ],
    machineryUsed: [{ type: String }],
    notes: { type: String },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved"],
      default: "submitted",
    },
  },
  { timestamps: true }
);

// One DPR per project per day
dprSchema.index({ tenantId: 1, project: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DPR", dprSchema);
