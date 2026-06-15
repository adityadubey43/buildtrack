const Project = require("../models/Project");

// GET /api/projects
const getProjects = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = { tenantId: req.tenantId };
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: "i" };

    const projects = await Project.find(filter)
      .populate("assignedEngineers", "name email role")
      .populate("assignedSupervisors", "name email role")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: projects.length, data: projects });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:id
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate("assignedEngineers", "name email role")
      .populate("assignedSupervisors", "name email role");

    if (!project) return res.status(404).json({ success: false, message: "Project not found." });
    res.json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
};

// POST /api/projects
const createProject = async (req, res, next) => {
  try {
    const {
      name, location, clientName, clientPhone, budget,
      startDate, endDate, phases, assignedEngineers, assignedSupervisors, notes,
    } = req.body;

    if (!name || !location || !budget || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Name, location, budget, start date, and end date are required." });
    }

    const defaultPhases = phases || [
      { name: "Excavation", completionPct: 0 },
      { name: "Foundation", completionPct: 0 },
      { name: "RCC Work", completionPct: 0 },
      { name: "Brickwork", completionPct: 0 },
      { name: "Finishing", completionPct: 0 },
    ];

    const project = await Project.create({
      tenantId: req.tenantId,
      name, location, clientName, clientPhone,
      budget: Number(budget),
      startDate, endDate,
      phases: defaultPhases,
      assignedEngineers: assignedEngineers || [],
      assignedSupervisors: assignedSupervisors || [],
      notes,
    });

    res.status(201).json({ success: true, message: "Project created successfully.", data: project });
  } catch (err) {
    next(err);
  }
};

// PUT /api/projects/:id
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });
    res.json({ success: true, message: "Project updated.", data: project });
  } catch (err) {
    next(err);
  }
};

// PUT /api/projects/:id/phase
const updatePhase = async (req, res, next) => {
  try {
    const { phaseId, completionPct } = req.body;
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });

    const phase = project.phases.id(phaseId);
    if (!phase) return res.status(404).json({ success: false, message: "Phase not found." });

    phase.completionPct = completionPct;
    phase.isCompleted = completionPct >= 100;

    // Recalculate overall progress
    const totalPct = project.phases.reduce((sum, p) => sum + p.completionPct, 0);
    project.overallProgress = Math.round(totalPct / project.phases.length);

    await project.save();
    res.json({ success: true, message: "Phase updated.", data: project });
  } catch (err) {
    next(err);
  }
};

// PUT /api/projects/:id/stages  — replace full stages array, auto-calc overallProgress
const updateStages = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });

    const stages = req.body.stages || [];

    // Preserve completedAt timestamp
    const existingMap = {};
    for (const p of project.phases) {
      if (p._id) existingMap[p._id.toString()] = p;
    }

    project.phases = stages.map((s) => {
      const existing = s._id && existingMap[s._id];
      const wasCompleted = existing ? existing.isCompleted : false;
      const nowCompleted = !!s.isCompleted;
      return {
        _id: s._id || undefined,
        name: s.name,
        weight: Number(s.weight) || 0,
        isCompleted: nowCompleted,
        completionPct: nowCompleted ? 100 : 0,
        completedAt: nowCompleted && !wasCompleted ? new Date() : (existing?.completedAt || null),
      };
    });

    // overallProgress = sum of weights of completed stages
    project.overallProgress = Math.min(
      100,
      Math.round(project.phases.filter((p) => p.isCompleted).reduce((s, p) => s + p.weight, 0))
    );

    await project.save();
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

// DELETE /api/projects/:id
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });
    res.json({ success: true, message: "Project deleted." });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/stats
const getProjectStats = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const [total, active, delayed, overBudget] = await Promise.all([
      Project.countDocuments({ tenantId }),
      Project.countDocuments({ tenantId, status: "active" }),
      Project.countDocuments({ tenantId, status: "active", overallProgress: { $lt: 50 } }),
      Project.countDocuments({ tenantId, $expr: { $gt: ["$amountSpent", { $multiply: ["$budget", 0.9] }] } }),
    ]);
    res.json({ success: true, data: { total, active, delayed, overBudget } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProjects, getProject, createProject, updateProject, updatePhase, updateStages, deleteProject, getProjectStats };
