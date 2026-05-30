const mongoose = require("mongoose");

const maintenanceLogSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  type: { type: String, enum: ["scheduled", "breakdown", "service"], required: true },
  description: { type: String },
  cost: { type: Number, default: 0 },
  performedBy: { type: String },
  nextDueDate: { type: Date },
});

const equipmentSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    model: { type: String },
    ownershipType: { type: String, enum: ["owned", "rented", "leased"], default: "owned" },
    rentalRate: { type: Number, default: 0 },
    assignedProject: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    status: {
      type: String,
      enum: ["active", "idle", "maintenance", "breakdown", "retired"],
      default: "idle",
    },
    totalHoursUsed: { type: Number, default: 0 },
    lastMaintenanceDate: { type: Date },
    nextMaintenanceDate: { type: Date },
    maintenanceLogs: [maintenanceLogSchema],
    purchaseDate: { type: Date },
    purchaseCost: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Equipment", equipmentSchema);
