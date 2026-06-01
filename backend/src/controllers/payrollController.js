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
      .populate("entries.projectBreakdown.project", "name")
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
      .populate("entries.projectBreakdown.project", "name location")
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

    // Group by worker and project
    const map = {};
    for (const r of attendanceRecords) {
      if (!r.worker) continue;
      const workerId = r.worker._id.toString();
      if (!map[workerId]) {
        map[workerId] = {
          worker: r.worker._id,
          workerObj: r.worker,
          projectMap: {},
        };
      }

      const m = map[workerId];
      const projKey = r.project?._id?.toString() || "unassigned";
      if (!m.projectMap[projKey]) {
        m.projectMap[projKey] = {
          project: r.project,
          present: 0,
          absent: 0,
          halfDays: 0,
          late: 0,
          leave: 0,
          overtimeHours: 0,
        };
      }

      const proj = m.projectMap[projKey];
      if (r.status === "present") proj.present += 1;
      else if (r.status === "absent") proj.absent += 1;
      else if (r.status === "half-day") proj.halfDays += 1;
      else if (r.status === "late") proj.late += 1;
      else if (r.status === "leave") proj.leave += 1;
      proj.overtimeHours += r.overtimeHours || 0;
    }

    let entries;

    if (workerType === "labour") {
      // Labour: days worked × daily wage + overtime, broken down by project when needed.
      entries = Object.values(map).map((w) => {
        const dailyWage = w.workerObj.dailyWage || 0;
        const breakdown = Object.values(w.projectMap).map((proj) => {
          const presentDays = proj.present;
          const daysWorked = proj.present + proj.late + proj.halfDays * 0.5;
          const basicAmount = presentDays * dailyWage + proj.late * dailyWage + proj.halfDays * dailyWage * 0.5;
          const overtimeRate = dailyWage > 0 ? (dailyWage / 8) * 1.5 : 0;
          const overtimeAmount = proj.overtimeHours * overtimeRate;
          const amount = Math.round(basicAmount + overtimeAmount);
          return {
            project: proj.project,
            daysWorked,
            presentDays,
            absentDays: proj.absent,
            halfDays: proj.halfDays,
            leaveDays: proj.leave,
            overtimeHours: proj.overtimeHours,
            amount,
          };
        });

        const totalAmount = breakdown.reduce((s, b) => s + b.amount, 0);
        return {
          worker: w.worker,
          project: breakdown.length === 1 ? breakdown[0].project : undefined,
          projectBreakdown: breakdown,
          presentDays: breakdown.reduce((s, b) => s + b.presentDays, 0),
          daysWorked: breakdown.reduce((s, b) => s + b.daysWorked, 0),
          halfDays: breakdown.reduce((s, b) => s + b.halfDays, 0),
          absentDays: breakdown.reduce((s, b) => s + b.absentDays, 0),
          leaveDays: breakdown.reduce((s, b) => s + b.leaveDays, 0),
          overtimeHours: breakdown.reduce((s, b) => s + b.overtimeHours, 0),
          dailyWage,
          basicAmount: breakdown.reduce((s, b) => s + Math.round((b.presentDays + b.late) * dailyWage + b.halfDays * dailyWage * 0.5), 0),
          overtimeAmount: breakdown.reduce((s, b) => s + Math.round(b.overtimeHours * (dailyWage > 0 ? (dailyWage / 8) * 1.5 : 0)), 0),
          deductions: 0,
          totalAmount,
          status: "pending",
        };
      });
    } else {
      // Employee: monthly salary − deduction for absent days (leaves are paid), allocate amount across projects.
      entries = Object.values(map).map((w) => {
        const monthlySalary = w.workerObj.monthlySalary || 0;
        const totalMarkedDays = Object.values(w.projectMap).reduce(
          (sum, proj) => sum + proj.present + proj.absent + proj.halfDays + proj.late + proj.leave,
          0
        );
        const perDay = totalMarkedDays > 0 ? monthlySalary / totalMarkedDays : 0;
        const deductions = Math.round(perDay * (Object.values(w.projectMap).reduce(
          (sum, proj) => sum + proj.absent + proj.halfDays * 0.5,
          0
        )));
        const totalAmount = Math.round(monthlySalary - deductions);

        let remainder = totalAmount;
        const breakdown = Object.values(w.projectMap).map((proj, index, list) => {
          const projectDays = proj.present + proj.absent + proj.halfDays + proj.late + proj.leave;
          const amount = index === list.length - 1
            ? remainder
            : Math.round(totalAmount * (projectDays / Math.max(totalMarkedDays, 1)));
          remainder -= amount;
          return {
            project: proj.project,
            daysWorked: proj.present + proj.late + proj.halfDays * 0.5,
            presentDays: proj.present,
            absentDays: proj.absent,
            halfDays: proj.halfDays,
            leaveDays: proj.leave,
            overtimeHours: 0,
            amount,
          };
        });

        return {
          worker: w.worker,
          project: breakdown.length === 1 ? breakdown[0].project : undefined,
          projectBreakdown: breakdown,
          presentDays: Object.values(w.projectMap).reduce((s, proj) => s + proj.present, 0),
          daysWorked: Object.values(w.projectMap).reduce((s, proj) => s + proj.present + proj.late + proj.halfDays * 0.5, 0),
          halfDays: Object.values(w.projectMap).reduce((s, proj) => s + proj.halfDays, 0),
          absentDays: Object.values(w.projectMap).reduce((s, proj) => s + proj.absent, 0),
          leaveDays: Object.values(w.projectMap).reduce((s, proj) => s + proj.leave, 0),
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
