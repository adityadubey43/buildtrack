const Worker = require("../models/Worker");

// GET /api/workers/me — Get current logged-in user's worker record (if exists)
const getMyWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ tenantId: req.tenantId, userId: req.user._id })
      .populate("assignedSite", "name location");
    if (!worker) return res.status(404).json({ success: false, message: "You are not registered as a worker." });
    res.json({ success: true, data: worker });
  } catch (err) {
    next(err);
  }
};

// GET /api/workers
const getWorkers = async (req, res, next) => {
  try {
    const { role, project, search, workerType, isActive } = req.query;
    const filter = { tenantId: req.tenantId };
    if (workerType) filter.workerType = workerType;
    if (role) filter.role = role;
    if (project) filter.assignedSite = project;
    // Default to active workers only; pass isActive=all to include everyone
    if (isActive === undefined) filter.isActive = true;
    else if (isActive !== "all") filter.isActive = isActive === "true";
    if (search) filter.name = { $regex: search, $options: "i" };

    const workers = await Worker.find(filter)
      .populate("assignedSite", "name location")
      .sort({ name: 1 });

    res.json({ success: true, count: workers.length, data: workers });
  } catch (err) {
    next(err);
  }
};

// GET /api/workers/:id
const getWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate("assignedSite", "name location");
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found." });
    res.json({ success: true, data: worker });
  } catch (err) {
    next(err);
  }
};

// POST /api/workers
const createWorker = async (req, res, next) => {
  try {
    const { name, phone, role, workerType, wageType, dailyWage, monthlySalary, contractAmount, assignedSite, joiningDate } = req.body;
    if (!name || !role) {
      return res.status(400).json({ success: false, message: "Name and role are required." });
    }
    const worker = await Worker.create({
      tenantId: req.tenantId,
      name, phone, role,
      workerType: workerType || "labour",
      wageType,
      dailyWage: Number(dailyWage) || 0,
      monthlySalary: Number(monthlySalary) || 0,
      contractAmount: Number(contractAmount) || 0,
      assignedSite, joiningDate,
    });
    res.status(201).json({ success: true, message: "Worker added.", data: worker });
  } catch (err) {
    next(err);
  }
};

// PUT /api/workers/:id
const updateWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found." });
    res.json({ success: true, message: "Worker updated.", data: worker });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/workers/:id (soft delete)
const deleteWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { isActive: false },
      { new: true }
    );
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found." });
    res.json({ success: true, message: "Worker deactivated." });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyWorker, getWorkers, getWorker, createWorker, updateWorker, deleteWorker };
