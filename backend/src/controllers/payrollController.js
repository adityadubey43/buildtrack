const Payroll = require("../models/Payroll");
const Attendance = require("../models/Attendance");
const Worker = require("../models/Worker");

// GET /api/payroll
const getPayrolls = async (req, res, next) => {
  try {
    const { workerType } = req.query;
    const filter = { tenantId: req.tenantId };
    if (workerType) filter.workerType = workerType;

    const payrolls = await Payroll.find(filter)
      .populate("entries.worker", "name role dailyWage monthlySalary wageType workerType")
      .populate("entries.project", "name")
      .populate("project", "name location")
      .sort({ weekStartDate: -1 });
    res.json({ success: true, count: payrolls.length, data: payrolls });
  } catch (err) {
    next(err);
  }
};

// GET /api/payroll/:id
const getPayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate("entries.worker", "name role phone dailyWage monthlySalary wageType workerType")
      .populate("entries.project", "name location")
      .populate("project", "name location");
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll not found." });
    res.json({ success: true, data: payroll });
  } catch (err) {
    next(err);
  }
};

// POST /api/payroll/calculate — flexible payroll generation
// Body: { workerType: "labour"|"employee", startDate, endDate, project?, cycle? }
const calculatePayroll = async (req, res, next) => {
  try {
    const {
      workerType = "labour",
      project,
      cycle,
      // accept both new and legacy field names
      startDate, endDate,
      weekStartDate, weekEndDate,
    } = req.body;

    const sRaw = startDate || weekStartDate;
    const eRaw = endDate || weekEndDate;
    if (!sRaw || !eRaw) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required." });
    }

    const start = new Date(sRaw); start.setHours(0, 0, 0, 0);
    const end = new Date(eRaw); end.setHours(23, 59, 59, 999);

    const resolvedCycle = cycle || (workerType === "employee" ? "monthly" : "weekly");

    // STRICT separation: labour payroll uses only labour attendance, employee only employee
    const attFilter = {
      tenantId: req.tenantId,
      attendanceType: workerType,
      date: { $gte: start, $lte: end },
    };
    if (project) attFilter.project = project;

    const attendanceRecords = await Attendance.find(attFilter).populate("worker");

    if (attendanceRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No ${workerType} attendance records found for this period${project ? " at this site" : ""}.`,
      });
    }

    // Group by worker
    const map = {};
    for (const r of attendanceRecords) {
      if (!r.worker) continue;
      const id = r.worker._id.toString();
      if (!map[id]) {
        map[id] = {
          worker: r.worker._id,
          project: r.project,
          workerObj: r.worker,
          present: 0, absent: 0, halfDays: 0, late: 0, leave: 0,
          overtimeHours: 0,
        };
      }
      const m = map[id];
      if (r.status === "present") m.present += 1;
      else if (r.status === "absent") m.absent += 1;
      else if (r.status === "half-day") m.halfDays += 1;
      else if (r.status === "late") m.late += 1;
      else if (r.status === "leave") m.leave += 1;
      m.overtimeHours += r.overtimeHours || 0;
    }

    let entries;

    if (workerType === "labour") {
      // Labour: days worked × daily wage + overtime
      entries = Object.values(map).map((w) => {
        const dailyWage = w.workerObj.dailyWage || 0;
        const daysWorked = w.present + w.late;
        const basicAmount = daysWorked * dailyWage + w.halfDays * dailyWage * 0.5;
        const overtimeRate = dailyWage > 0 ? (dailyWage / 8) * 1.5 : 0;
        const overtimeAmount = w.overtimeHours * overtimeRate;
        const totalAmount = Math.round(basicAmount + overtimeAmount);
        return {
          worker: w.worker,
          project: w.project,
          presentDays: w.present,
          daysWorked,
          halfDays: w.halfDays,
          absentDays: w.absent,
          leaveDays: w.leave,
          overtimeHours: w.overtimeHours,
          dailyWage,
          basicAmount: Math.round(basicAmount),
          overtimeAmount: Math.round(overtimeAmount),
          deductions: 0,
          totalAmount,
          status: "pending",
        };
      });
    } else {
      // Employee: monthly salary − deduction for absent days (leaves are paid)
      entries = Object.values(map).map((w) => {
        const monthlySalary = w.workerObj.monthlySalary || 0;
        const markedDays = w.present + w.absent + w.halfDays + w.late + w.leave;
        const perDay = markedDays > 0 ? monthlySalary / markedDays : 0;
        // Absent days deduct; half-days deduct half; leaves are paid
        const deductions = Math.round(perDay * (w.absent + w.halfDays * 0.5));
        const totalAmount = Math.round(monthlySalary - deductions);
        return {
          worker: w.worker,
          project: w.project,
          presentDays: w.present,
          daysWorked: w.present + w.late,
          halfDays: w.halfDays,
          absentDays: w.absent,
          leaveDays: w.leave,
          overtimeHours: 0,
          monthlySalary,
          basicAmount: monthlySalary,
          overtimeAmount: 0,
          deductions,
          totalAmount,
          status: "pending",
        };
      });
    }

    const totalAmount = entries.reduce((s, e) => s + e.totalAmount, 0);

    const fmt = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const weekLabel =
      resolvedCycle === "monthly"
        ? `${start.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`
        : `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${fmt(end)}`;

    const payroll = await Payroll.create({
      tenantId: req.tenantId,
      workerType,
      cycle: resolvedCycle,
      project: project || undefined,
      weekStartDate: start,
      weekEndDate: end,
      weekLabel,
      entries,
      totalAmount,
      pendingAmount: totalAmount,
      paidAmount: 0,
      status: "calculated",
      generatedBy: req.user._id,
    });

    await payroll.populate([
      { path: "entries.worker", select: "name role dailyWage monthlySalary workerType" },
      { path: "entries.project", select: "name" },
      { path: "project", select: "name location" },
    ]);

    res.status(201).json({ success: true, message: `${workerType === "labour" ? "Labour" : "Employee"} payroll calculated.`, data: payroll });
  } catch (err) {
    next(err);
  }
};

// PUT /api/payroll/:id/pay — pay one or all entries
const processPayment = async (req, res, next) => {
  try {
    const { entryId, payAll, paymentMode, transactionRef } = req.body;
    const payroll = await Payroll.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll not found." });

    const now = new Date();

    if (payAll) {
      payroll.entries.forEach((entry) => {
        if (entry.status === "pending") {
          entry.status = "paid";
          entry.paidOn = now;
          entry.paymentMode = paymentMode || "cash";
          entry.transactionRef = transactionRef;
        }
      });
    } else if (entryId) {
      const entry = payroll.entries.id(entryId);
      if (!entry) return res.status(404).json({ success: false, message: "Entry not found." });
      entry.status = "paid";
      entry.paidOn = now;
      entry.paymentMode = paymentMode || "cash";
      entry.transactionRef = transactionRef;
    }

    payroll.paidAmount = payroll.entries.filter((e) => e.status === "paid").reduce((s, e) => s + e.totalAmount, 0);
    payroll.pendingAmount = payroll.entries.filter((e) => e.status === "pending").reduce((s, e) => s + e.totalAmount, 0);
    payroll.status = payroll.pendingAmount === 0 ? "paid" : payroll.paidAmount > 0 ? "partially-paid" : "calculated";

    await payroll.save();
    res.json({ success: true, message: "Payment processed.", data: payroll });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/payroll/:id
const deletePayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll not found." });
    res.json({ success: true, message: "Payroll deleted." });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPayrolls, getPayroll, calculatePayroll, processPayment, deletePayroll };
