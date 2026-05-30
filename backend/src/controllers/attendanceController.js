const Attendance = require("../models/Attendance");
const Worker = require("../models/Worker");
const Project = require("../models/Project");

// Build a date filter supporting single `date` or a `startDate`/`endDate` range
function buildDateFilter({ date, startDate, endDate }) {
  if (date) {
    const d = new Date(date);
    return {
      $gte: new Date(new Date(d).setHours(0, 0, 0, 0)),
      $lte: new Date(new Date(d).setHours(23, 59, 59, 999)),
    };
  }
  if (startDate || endDate) {
    const range = {};
    if (startDate) range.$gte = new Date(new Date(startDate).setHours(0, 0, 0, 0));
    if (endDate) range.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    return range;
  }
  return null;
}

// GET /api/attendance
const getAttendance = async (req, res, next) => {
  try {
    const { date, startDate, endDate, project, worker, status, type } = req.query;
    const filter = { tenantId: req.tenantId };

    const dateFilter = buildDateFilter({ date, startDate, endDate });
    if (dateFilter) filter.date = dateFilter;
    if (project) filter.project = project;
    if (worker) filter.worker = worker;
    if (status) filter.status = status;
    if (type) filter.attendanceType = type; // "labour" | "employee"

    const records = await Attendance.find(filter)
      .populate("worker", "name role phone dailyWage monthlySalary workerType")
      .populate("project", "name location")
      .populate("markedBy", "name role")
      .sort({ date: -1, createdAt: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
};

// GET /api/attendance/summary
const getAttendanceSummary = async (req, res, next) => {
  try {
    const { date, startDate, endDate, project, type } = req.query;
    const filter = { tenantId: req.tenantId };

    const dateFilter = buildDateFilter({
      date: date || (!startDate && !endDate ? new Date().toISOString().split("T")[0] : undefined),
      startDate,
      endDate,
    });
    if (dateFilter) filter.date = dateFilter;
    if (project) filter.project = project;
    if (type) filter.attendanceType = type;

    const [present, absent, late, halfDay, leave] = await Promise.all([
      Attendance.countDocuments({ ...filter, status: "present" }),
      Attendance.countDocuments({ ...filter, status: "absent" }),
      Attendance.countDocuments({ ...filter, status: "late" }),
      Attendance.countDocuments({ ...filter, status: "half-day" }),
      Attendance.countDocuments({ ...filter, status: "leave" }),
    ]);

    res.json({
      success: true,
      data: { present, absent, late, halfDay, leave, total: present + absent + late + halfDay + leave },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/attendance — mark single or bulk
const markAttendance = async (req, res, next) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "Attendance records array is required." });
    }

    // Resolve attendanceType from the worker when not explicitly provided
    const workerIds = [...new Set(records.map((r) => r.worker).filter(Boolean))];
    const workers = await Worker.find({ tenantId: req.tenantId, _id: { $in: workerIds } }, "workerType");
    const typeByWorker = Object.fromEntries(workers.map((w) => [w._id.toString(), w.workerType || "labour"]));

    // Manual marking of EMPLOYEE/staff attendance is an admin/accountant-only fallback
    const touchesEmployee = records.some(
      (r) => (r.attendanceType || typeByWorker[String(r.worker)]) === "employee"
    );
    if (touchesEmployee && !["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or accountant can manually mark staff attendance. Staff should use Check-in / Check-out.",
      });
    }

    const enriched = records.map((r) => ({
      ...r,
      tenantId: req.tenantId,
      markedBy: req.user._id,
      attendanceType: r.attendanceType || typeByWorker[String(r.worker)] || "labour",
      date: new Date(r.date || Date.now()),
    }));

    const results = await Promise.allSettled(
      enriched.map((r) =>
        Attendance.findOneAndUpdate(
          { tenantId: r.tenantId, worker: r.worker, project: r.project, date: r.date },
          r,
          { upsert: true, new: true, runValidators: true }
        )
      )
    );

    const saved = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    res.status(201).json({
      success: true,
      message: `${saved} attendance record(s) saved.${failed > 0 ? ` ${failed} failed.` : ""}`,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/attendance/:id — correction
const updateAttendance = async (req, res, next) => {
  try {
    const { status, timeIn, timeOut, correctionNote, correctionApproved } = req.body;
    const record = await Attendance.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!record) return res.status(404).json({ success: false, message: "Attendance record not found." });

    if (correctionApproved !== undefined) {
      record.correctionApproved = correctionApproved;
      record.correctionApprovedBy = req.user._id;
      if (correctionApproved && status) record.status = status;
    } else if (correctionNote) {
      record.correctionRequested = true;
      record.correctionNote = correctionNote;
    }

    if (status) record.status = status;
    if (timeIn !== undefined) record.timeIn = timeIn;
    if (timeOut !== undefined) record.timeOut = timeOut;

    await record.save();
    res.json({ success: true, message: "Attendance updated.", data: record });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/attendance/:id
const deleteAttendance = async (req, res, next) => {
  try {
    const record = await Attendance.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!record) return res.status(404).json({ success: false, message: "Attendance record not found." });
    res.json({ success: true, message: "Attendance record deleted." });
  } catch (err) {
    next(err);
  }
};

// GET /api/attendance/weekly-summary — per-worker breakdown over a range (Labour)
const getWeeklySummary = async (req, res, next) => {
  try {
    const { startDate, endDate, project, type = "labour", workerId } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required." });
    }

    const filter = {
      tenantId: req.tenantId,
      attendanceType: type,
      date: {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      },
    };
    if (project) filter.project = project;
    if (workerId) filter.worker = workerId;

    const records = await Attendance.find(filter)
      .populate("worker", "name role dailyWage")
      .populate("project", "name");

    // Group by worker
    const map = {};
    for (const r of records) {
      if (!r.worker) continue;
      const id = r.worker._id.toString();
      if (!map[id]) {
        map[id] = {
          workerId: id,
          name: r.worker.name,
          role: r.worker.role,
          dailyWage: r.worker.dailyWage || 0,
          present: 0, absent: 0, halfDays: 0, late: 0, leave: 0,
          overtimeHours: 0,
          sites: new Set(),
        };
      }
      const m = map[id];
      if (r.status === "present") m.present += 1;
      else if (r.status === "absent") m.absent += 1;
      else if (r.status === "half-day") m.halfDays += 1;
      else if (r.status === "late") m.late += 1;
      else if (r.status === "leave") m.leave += 1;
      m.overtimeHours += r.overtimeHours || 0;
      if (r.project?.name) m.sites.add(r.project.name);
    }

    const summary = Object.values(map).map((m) => ({
      ...m,
      daysWorked: m.present + m.late + m.halfDays * 0.5,
      sites: [...m.sites],
    }));

    res.json({ success: true, count: summary.length, data: summary });
  } catch (err) {
    next(err);
  }
};

// GET /api/attendance/monthly-summary — per-employee monthly breakdown (Employee)
const getMonthlySummary = async (req, res, next) => {
  try {
    const { month, year, project, type = "employee" } = req.query;
    const now = new Date();
    const y = Number(year) || now.getFullYear();
    const m = month !== undefined ? Number(month) : now.getMonth(); // 0-indexed

    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const filter = {
      tenantId: req.tenantId,
      attendanceType: type,
      date: { $gte: start, $lte: end },
    };
    if (project) filter.project = project;

    const records = await Attendance.find(filter)
      .populate("worker", "name role monthlySalary")
      .populate("project", "name");

    const map = {};
    for (const r of records) {
      if (!r.worker) continue;
      const id = r.worker._id.toString();
      if (!map[id]) {
        map[id] = {
          workerId: id,
          name: r.worker.name,
          role: r.worker.role,
          monthlySalary: r.worker.monthlySalary || 0,
          present: 0, absent: 0, leave: 0, halfDays: 0, late: 0,
          totalHours: 0,
          records: [],
        };
      }
      const e = map[id];
      if (r.status === "present") e.present += 1;
      else if (r.status === "absent") e.absent += 1;
      else if (r.status === "leave") e.leave += 1;
      else if (r.status === "half-day") e.halfDays += 1;
      else if (r.status === "late") e.late += 1;
      e.totalHours += r.hoursWorked || 0;
      e.records.push({ date: r.date, status: r.status, timeIn: r.timeIn, timeOut: r.timeOut, hoursWorked: r.hoursWorked || 0 });
    }
    // Round totals
    Object.values(map).forEach((e) => { e.totalHours = Math.round(e.totalHours * 100) / 100; });

    res.json({
      success: true,
      month: m,
      year: y,
      daysInMonth: new Date(y, m + 1, 0).getDate(),
      count: Object.keys(map).length,
      data: Object.values(map),
    });
  } catch (err) {
    next(err);
  }
};

// Resolve a project for an employee check-in (explicit > worker's assigned site)
async function resolveProject(tenantId, worker, providedProject) {
  if (providedProject) return providedProject;
  if (worker.assignedSite) return worker.assignedSite;
  return null;
}

function dayBounds(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}

function hhmm(date) {
  return date.toTimeString().slice(0, 5);
}

// Find (or auto-create) the Worker record linked to the logged-in user.
// Every login is a staff member who can mark their own attendance.
async function getOrCreateSelfWorker(req) {
  let w = await Worker.findOne({ tenantId: req.tenantId, userId: req.user._id });
  if (w) return w;
  const roleMap = {
    engineer: "engineer", supervisor: "supervisor", accountant: "accountant",
    admin: "office-staff", partner: "office-staff",
  };
  const firstProj = await Project.findOne({ tenantId: req.tenantId, status: "active" }).sort({ createdAt: 1 });
  return Worker.create({
    tenantId: req.tenantId,
    userId: req.user._id,
    name: req.user.name,
    role: roleMap[req.user.role] || "office-staff",
    workerType: "employee",
    monthlySalary: 0,
    assignedSite: firstProj ? firstProj._id : undefined,
  });
}

// POST /api/attendance/checkin — staff check-in with photo proof (self by default)
const checkIn = async (req, res, next) => {
  try {
    const { worker, project, photoUrl, date } = req.body;
    if (!photoUrl) return res.status(400).json({ success: false, message: "Check-in photo is required." });

    let w;
    if (!worker) {
      // No worker id → checking in for yourself
      w = await getOrCreateSelfWorker(req);
    } else {
      w = await Worker.findOne({ tenantId: req.tenantId, _id: worker });
      if (!w) return res.status(404).json({ success: false, message: "Staff member not found." });
      // Staff can only check in for THEMSELVES; only admin/accountant can do it for anyone else
      const isSelf = w.userId && w.userId.toString() === req.user._id.toString();
      if (!isSelf && !["admin", "accountant"].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "You can only check in for yourself. Only admin or accountant can check in for others." });
      }
    }

    const proj = await resolveProject(req.tenantId, w, project);
    if (!proj) return res.status(400).json({ success: false, message: "No site assigned. Select a site for this staff member." });

    const { start } = dayBounds(date);
    const now = new Date();

    const existing = await Attendance.findOne({
      tenantId: req.tenantId, worker: w._id, attendanceType: "employee",
      date: { $gte: start, $lte: new Date(start.getTime() + 86399999) },
    });
    if (existing && existing.checkInAt) {
      return res.status(409).json({ success: false, message: "Already checked in today." });
    }

    const record = await Attendance.findOneAndUpdate(
      { tenantId: req.tenantId, worker: w._id, project: proj, date: start },
      {
        tenantId: req.tenantId, worker: w._id, project: proj, date: start,
        attendanceType: "employee", status: "present",
        checkInAt: now, checkInPhoto: photoUrl, timeIn: hhmm(now),
        markedBy: req.user._id,
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json({ success: true, message: `Checked in at ${hhmm(now)}.`, data: record });
  } catch (err) {
    next(err);
  }
};

// POST /api/attendance/checkout — staff check-out, computes hours worked
const checkOut = async (req, res, next) => {
  try {
    const { worker, project, photoUrl, date } = req.body;
    if (!photoUrl) return res.status(400).json({ success: false, message: "Check-out photo is required." });

    let w;
    if (!worker) {
      w = await getOrCreateSelfWorker(req);
    } else {
      w = await Worker.findOne({ tenantId: req.tenantId, _id: worker });
      if (!w) return res.status(404).json({ success: false, message: "Staff member not found." });
      const isSelf = w.userId && w.userId.toString() === req.user._id.toString();
      if (!isSelf && !["admin", "accountant"].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "You can only check out for yourself. Only admin or accountant can check out for others." });
      }
    }

    const proj = await resolveProject(req.tenantId, w, project);
    const { start, end } = dayBounds(date);
    const now = new Date();

    const record = await Attendance.findOne({
      tenantId: req.tenantId, worker: w._id, attendanceType: "employee",
      date: { $gte: start, $lte: end },
      ...(proj ? { project: proj } : {}),
    });

    if (!record || !record.checkInAt) {
      return res.status(400).json({ success: false, message: "No check-in found for today. Check in first." });
    }
    if (record.checkOutAt) {
      return res.status(409).json({ success: false, message: "Already checked out today." });
    }

    record.checkOutAt = now;
    record.checkOutPhoto = photoUrl;
    record.timeOut = hhmm(now);
    record.hoursWorked = Math.round(((now - record.checkInAt) / 3600000) * 100) / 100;
    await record.save();

    res.json({ success: true, message: `Checked out at ${hhmm(now)} · ${record.hoursWorked} hrs worked.`, data: record });
  } catch (err) {
    next(err);
  }
};

// GET /api/attendance/me/today — the logged-in user's own attendance for today
const getMyToday = async (req, res, next) => {
  try {
    const self = await Worker.findOne({ tenantId: req.tenantId, userId: req.user._id });
    if (!self) {
      return res.json({ success: true, data: null, worker: { name: req.user.name } });
    }
    const { start, end } = dayBounds();
    const record = await Attendance.findOne({
      tenantId: req.tenantId, worker: self._id, attendanceType: "employee",
      date: { $gte: start, $lte: end },
    });
    res.json({ success: true, data: record || null, worker: { _id: self._id, name: self.name } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAttendance,
  getAttendanceSummary,
  markAttendance,
  updateAttendance,
  deleteAttendance,
  getWeeklySummary,
  getMonthlySummary,
  checkIn,
  checkOut,
  getMyToday,
};
