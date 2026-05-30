const DPR = require("../models/DPR");
const Project = require("../models/Project");

// GET /api/dpr
const getDPRs = async (req, res, next) => {
  try {
    const { project, date, startDate, endDate, status } = req.query;
    const filter = { tenantId: req.tenantId };

    if (project) filter.project = project;
    if (status) filter.status = status;

    if (date) {
      const d = new Date(date);
      filter.date = {
        $gte: new Date(d.setHours(0, 0, 0, 0)),
        $lte: new Date(d.setHours(23, 59, 59, 999)),
      };
    } else if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const dprs = await DPR.find(filter)
      .populate("project", "name location")
      .populate("submittedBy", "name role")
      .sort({ date: -1 });

    res.json({ success: true, count: dprs.length, data: dprs });
  } catch (err) {
    next(err);
  }
};

// GET /api/dpr/:id
const getDPR = async (req, res, next) => {
  try {
    const dpr = await DPR.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate("project", "name location")
      .populate("submittedBy", "name role");
    if (!dpr) return res.status(404).json({ success: false, message: "DPR not found." });
    res.json({ success: true, data: dpr });
  } catch (err) {
    next(err);
  }
};

// POST /api/dpr
const createDPR = async (req, res, next) => {
  try {
    const {
      project, date, workActivity, workDescription, workersPresent,
      weather, images, hasDelay, delayReason, delayHours,
      materialsUsed, machineryUsed, notes,
    } = req.body;

    if (!project || !workActivity) {
      return res.status(400).json({ success: false, message: "Project and work activity are required." });
    }

    // Verify project belongs to tenant
    const proj = await Project.findOne({ _id: project, tenantId: req.tenantId });
    if (!proj) return res.status(404).json({ success: false, message: "Project not found." });

    const dprDate = date ? new Date(date) : new Date();

    const dpr = await DPR.create({
      tenantId: req.tenantId,
      project, date: dprDate,
      submittedBy: req.user._id,
      workActivity, workDescription,
      workersPresent: Number(workersPresent) || 0,
      weather, images: images || [],
      hasDelay: Boolean(hasDelay),
      delayReason, delayHours: Number(delayHours) || 0,
      materialsUsed: materialsUsed || [],
      machineryUsed: machineryUsed || [],
      notes, status: "submitted",
    });

    await DPR.populate(dpr, [
      { path: "project", select: "name location" },
      { path: "submittedBy", select: "name role" },
    ]);

    res.status(201).json({ success: true, message: "DPR submitted.", data: dpr });
  } catch (err) {
    next(err);
  }
};

// PUT /api/dpr/:id
const updateDPR = async (req, res, next) => {
  try {
    const dpr = await DPR.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!dpr) return res.status(404).json({ success: false, message: "DPR not found." });
    res.json({ success: true, message: "DPR updated.", data: dpr });
  } catch (err) {
    next(err);
  }
};

// GET /api/dpr/missing-today — projects that haven't submitted DPR today
const getMissingDPRs = async (req, res, next) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const [allProjects, submittedToday] = await Promise.all([
      Project.find({ tenantId: req.tenantId, status: "active" }, "_id name location"),
      DPR.find({ tenantId: req.tenantId, date: { $gte: startOfDay, $lte: endOfDay } }, "project"),
    ]);

    const submittedIds = new Set(submittedToday.map((d) => d.project.toString()));
    const missing = allProjects.filter((p) => !submittedIds.has(p._id.toString()));

    res.json({ success: true, count: missing.length, data: missing });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDPRs, getDPR, createDPR, updateDPR, getMissingDPRs };
