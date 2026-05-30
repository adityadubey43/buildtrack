const Expense = require("../models/Expense");
const Project = require("../models/Project");

// GET /api/expenses
const getExpenses = async (req, res, next) => {
  try {
    const { project, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { tenantId: req.tenantId };

    if (project) filter.project = project;
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .populate("project", "name location")
        .populate("recordedBy", "name")
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Expense.countDocuments(filter),
    ]);

    res.json({ success: true, count: total, data: expenses });
  } catch (err) {
    next(err);
  }
};

// GET /api/expenses/summary — totals grouped
const getExpenseSummary = async (req, res, next) => {
  try {
    const { project, startDate, endDate } = req.query;
    const match = { tenantId: req.tenantId };
    if (project) match.project = require("mongoose").Types.ObjectId.createFromHexString(project);
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); match.date.$lte = e; }
    }

    const byType = await Expense.aggregate([
      { $match: match },
      { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const byProject = await Expense.aggregate([
      { $match: { tenantId: req.tenantId, ...(startDate || endDate ? { date: match.date } : {}) } },
      { $group: { _id: "$project", total: { $sum: "$amount" } } },
      { $lookup: { from: "projects", localField: "_id", foreignField: "_id", as: "project" } },
      { $unwind: "$project" },
      { $project: { _id: 1, total: 1, "project.name": 1, "project.location": 1 } },
    ]);

    const grandTotal = byType.reduce((s, r) => s + r.total, 0);

    res.json({ success: true, data: { grandTotal, byType, byProject } });
  } catch (err) {
    next(err);
  }
};

// POST /api/expenses
const createExpense = async (req, res, next) => {
  try {
    const { project, type, description, amount, date, vendor, invoiceNumber, paymentMode, notes, attachments } = req.body;

    if (!project || !type || !description || !amount) {
      return res.status(400).json({ success: false, message: "Project, type, description, and amount are required." });
    }

    const proj = await Project.findOne({ _id: project, tenantId: req.tenantId });
    if (!proj) return res.status(404).json({ success: false, message: "Project not found." });

    const expense = await Expense.create({
      tenantId: req.tenantId,
      project, type, description,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      vendor, invoiceNumber, paymentMode, notes,
      attachments: attachments || [],
      recordedBy: req.user._id,
    });

    // Update project amountSpent
    await Project.findByIdAndUpdate(project, { $inc: { amountSpent: Number(amount) } });

    await expense.populate([
      { path: "project", select: "name location" },
      { path: "recordedBy", select: "name" },
    ]);

    res.status(201).json({ success: true, message: "Expense recorded.", data: expense });
  } catch (err) {
    next(err);
  }
};

// PUT /api/expenses/:id
const updateExpense = async (req, res, next) => {
  try {
    const old = await Expense.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!old) return res.status(404).json({ success: false, message: "Expense not found." });

    const diff = (req.body.amount ? Number(req.body.amount) : old.amount) - old.amount;

    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate("project", "name location")
      .populate("recordedBy", "name");

    if (diff !== 0) {
      await Project.findByIdAndUpdate(old.project, { $inc: { amountSpent: diff } });
    }

    res.json({ success: true, message: "Expense updated.", data: expense });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/expenses/:id
const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found." });

    // Reverse the amountSpent
    await Project.findByIdAndUpdate(expense.project, { $inc: { amountSpent: -expense.amount } });

    res.json({ success: true, message: "Expense deleted." });
  } catch (err) {
    next(err);
  }
};

module.exports = { getExpenses, getExpenseSummary, createExpense, updateExpense, deleteExpense };
