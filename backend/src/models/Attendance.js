const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    // Denormalised from the worker so labour & employee attendance stay strictly separate
    attendanceType: {
      type: String,
      enum: ["labour", "employee"],
      default: "labour",
      index: true,
    },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["present", "absent", "half-day", "late", "leave"],
      required: true,
    },
    timeIn: { type: String },
    timeOut: { type: String },
    // Employee check-in/out flow (photo proof + computed hours)
    checkInAt: { type: Date },
    checkOutAt: { type: Date },
    checkInPhoto: { type: String },
    checkOutPhoto: { type: String },
    hoursWorked: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    photoUrl: { type: String },
    geoLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    correctionRequested: { type: Boolean, default: false },
    correctionNote: { type: String },
    correctionApproved: { type: Boolean },
    correctionApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
  },
  { timestamps: true }
);

// Prevent duplicate attendance for same worker on same day at same project
attendanceSchema.index({ tenantId: 1, worker: 1, project: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
