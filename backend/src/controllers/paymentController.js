const PaymentReceived = require("../models/PaymentReceived");
const Project = require("../models/Project");

// GET /api/payments
const getPayments = async (req, res, next) => {
  try {
    const { project, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { tenantId: req.tenantId };

    if (project) filter.project = project;
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
    const [payments, total] = await Promise.all([
      PaymentReceived.find(filter)
        .populate("project", "name location")
        .populate("recordedBy", "name")
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PaymentReceived.countDocuments(filter),
    ]);

    res.json({ success: true, count: total, data: payments });
  } catch (err) {
    next(err);
  }
};

// GET /api/payments/summary
const getPaymentSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { tenantId: req.tenantId };
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); match.date.$lte = e; }
    }

    const byProject = await PaymentReceived.aggregate([
      { $match: match },
      { $group: { _id: "$project", total: { $sum: "$amount" } } },
      { $lookup: { from: "projects", localField: "_id", foreignField: "_id", as: "project" } },
      { $unwind: "$project" },
      { $project: { projectId: "$_id", projectName: "$project.name", total: 1, _id: 0 } },
    ]);

    const grandTotal = byProject.reduce((s, r) => s + r.total, 0);

    res.json({ success: true, data: { grandTotal, byProject } });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments
const createPayment = async (req, res, next) => {
  try {
    const { project, clientName, amount, date, paymentMode, reference, milestone, notes, attachments } = req.body;

    if (!project || !clientName || !amount) {
      return res.status(400).json({ success: false, message: "Project, clientName, and amount are required." });
    }

    const proj = await Project.findOne({ _id: project, tenantId: req.tenantId });
    if (!proj) return res.status(404).json({ success: false, message: "Project not found." });

    const payment = await PaymentReceived.create({
      tenantId: req.tenantId,
      project, clientName,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      paymentMode, reference, milestone, notes,
      attachments: attachments || [],
      recordedBy: req.user._id,
    });

    await payment.populate([
      { path: "project", select: "name location" },
      { path: "recordedBy", select: "name" },
    ]);

    res.status(201).json({ success: true, message: "Payment recorded.", data: payment });
  } catch (err) {
    next(err);
  }
};

// PUT /api/payments/:id
const updatePayment = async (req, res, next) => {
  try {
    const payment = await PaymentReceived.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true }
    )
      .populate("project", "name location")
      .populate("recordedBy", "name");

    if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });

    res.json({ success: true, message: "Payment updated.", data: payment });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/payments/:id
const deletePayment = async (req, res, next) => {
  try {
    const payment = await PaymentReceived.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });

    res.json({ success: true, message: "Payment deleted." });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPayments, getPaymentSummary, createPayment, updatePayment, deletePayment };
