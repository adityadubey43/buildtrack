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
      .populate("userId", "email")
      .sort({ name: 1 });

    // Add email field from userId to the response
    const workersWithEmail = workers.map(w => {
      const workerObj = w.toObject();
      if (w.userId && w.userId.email) {
        workerObj.email = w.userId.email;
      }
      return workerObj;
    });

    res.json({ success: true, count: workersWithEmail.length, data: workersWithEmail });
  } catch (err) {
    next(err);
  }
};

// GET /api/workers/:id
const getWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate("assignedSite", "name location")
      .populate("userId", "email");
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found." });
    
    const workerObj = worker.toObject();
    if (worker.userId && worker.userId.email) {
      workerObj.email = worker.userId.email;
    }
    
    res.json({ success: true, data: workerObj });
  } catch (err) {
    next(err);
  }
};

// POST /api/workers
const createWorker = async (req, res, next) => {
  try {
    const { name, phone, email, password, role, workerType, wageType, dailyWage, monthlySalary, contractAmount, assignedSite, joiningDate } = req.body;
    if (!name || !role) {
      return res.status(400).json({ success: false, message: "Name and role are required." });
    }
    
    let userId;
    if (workerType === "employee" && email && password) {
      const User = require("../models/User");
      
      // Check if email already exists
      const existingUser = await User.findOne({ email, tenantId: req.tenantId });
      if (existingUser) {
        console.warn("⚠️ Email already registered:", email);
        return res.status(400).json({ success: false, message: "This email is already registered." });
      }
      
      // Create User account for employee
      const user = await User.create({
        tenantId: req.tenantId,
        name,
        email,
        password,
        role: role === "labour" ? "engineer" : role,
        phone,
        isActive: true,
      });
      console.log("✅ User created for team member:", {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        tenantId: user.tenantId,
      });
      userId = user._id;
    }
    
    const worker = await Worker.create({
      tenantId: req.tenantId,
      name, phone, role,
      workerType: workerType || "labour",
      wageType,
      dailyWage: Number(dailyWage) || 0,
      monthlySalary: Number(monthlySalary) || 0,
      contractAmount: Number(contractAmount) || 0,
      assignedSite,
      joiningDate,
      userId,
    });
    
    // If a User was created, include indication in response
    const wasTeamMemberCreated = !!userId;
    
    console.log("✅ Worker created:", {
      workerId: worker._id,
      name: worker.name,
      workerType: worker.workerType,
      userId: userId,
      wasTeamMemberCreated: wasTeamMemberCreated,
    });
    
    // Add email to response if it was created
    const responseData = worker.toObject();
    if (email) {
      responseData.email = email;
    }
    
    res.status(201).json({ 
      success: true, 
      message: wasTeamMemberCreated 
        ? `${name} added as staff and is now a team member. They can log in with their email and password.`
        : `${name} added as site worker.`,
      data: responseData,
      teamMemberCreated: wasTeamMemberCreated,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/workers/:id
const updateWorker = async (req, res, next) => {
  try {
    const { password, ...workerData } = req.body;
    
    const worker = await Worker.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found." });
    
    // If updating password for an employee with a User account
    if (password && worker.userId && worker.workerType === "employee") {
      const User = require("../models/User");
      const user = await User.findOne({ _id: worker.userId, tenantId: req.tenantId });
      if (user) {
        user.password = password; // Will be hashed by pre-save hook
        await user.save();
        console.log("✅ User password updated for worker:", worker._id);
      }
    }
    
    // Update worker fields
    const updatedWorker = await Worker.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      workerData,
      { new: true, runValidators: true }
    ).populate("userId", "email");
    
    const workerObj = updatedWorker.toObject();
    if (updatedWorker.userId && updatedWorker.userId.email) {
      workerObj.email = updatedWorker.userId.email;
    }
    
    console.log("✅ Worker updated:", { workerId: updatedWorker._id, name: updatedWorker.name });
    res.json({ success: true, message: "Worker updated.", data: workerObj });
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
