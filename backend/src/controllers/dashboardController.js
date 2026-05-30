const Project = require("../models/Project");
const Worker = require("../models/Worker");
const Attendance = require("../models/Attendance");
const Payroll = require("../models/Payroll");
const DPR = require("../models/DPR");
const Invoice = require("../models/Invoice");
const { Material } = require("../models/Material");
const Expense = require("../models/Expense");
const PaymentReceived = require("../models/PaymentReceived");

// GET /api/dashboard/stats
const getDashboardStats = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

    const [
      activeProjects,
      totalWorkers,
      todayPresent,
      pendingPayroll,
      pendingInvoices,
      lowStockMaterials,
      missingDPRsToday,
      recentDPRs,
      expenseTotals,
      paymentTotals,
    ] = await Promise.all([
      Project.countDocuments({ tenantId, status: "active" }),
      Worker.countDocuments({ tenantId, isActive: true }),
      Attendance.countDocuments({ tenantId, status: "present", date: { $gte: startOfDay, $lte: endOfDay } }),
      Payroll.aggregate([
        { $match: { tenantId, status: { $in: ["calculated", "partially-paid"] } } },
        { $group: { _id: null, total: { $sum: "$pendingAmount" } } },
      ]),
      Invoice.aggregate([
        { $match: { tenantId, status: { $in: ["sent", "partially-paid", "overdue"] } } },
        { $group: { _id: null, total: { $sum: "$balanceAmount" } } },
      ]),
      Material.countDocuments({ tenantId, $expr: { $lte: ["$currentStock", "$minimumStock"] } }),
      (async () => {
        const [projects, submitted] = await Promise.all([
          Project.find({ tenantId, status: "active" }, "_id"),
          DPR.find({ tenantId, date: { $gte: startOfDay, $lte: endOfDay } }, "project"),
        ]);
        const submittedIds = new Set(submitted.map((d) => d.project.toString()));
        return projects.filter((p) => !submittedIds.has(p._id.toString())).length;
      })(),
      DPR.find({ tenantId }).populate("project", "name").populate("submittedBy", "name").sort({ date: -1 }).limit(5),
      Expense.aggregate([
        { $match: { tenantId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PaymentReceived.aggregate([
        { $match: { tenantId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    // Budget overview per project
    const activeProjectsList = await Project.find({ tenantId, status: "active" })
      .select("name location budget amountSpent overallProgress currentPhase status")
      .sort({ createdAt: -1 });

    const projects = activeProjectsList.slice(0, 5);

    // Project financials
    const projectExpenses = await Expense.aggregate([
      { $match: { tenantId } },
      { $group: { _id: "$project", totalExpenses: { $sum: "$amount" } } },
    ]);
    const projectPayments = await PaymentReceived.aggregate([
      { $match: { tenantId } },
      { $group: { _id: "$project", totalPayments: { $sum: "$amount" } } },
    ]);

    const expMap = Object.fromEntries(projectExpenses.map((e) => [e._id.toString(), e.totalExpenses]));
    const payMap = Object.fromEntries(projectPayments.map((p) => [p._id.toString(), p.totalPayments]));

    const projectFinancials = activeProjectsList.map((p) => {
      const totalExpenses = expMap[p._id.toString()] || 0;
      const totalPayments = payMap[p._id.toString()] || 0;
      return {
        projectId: p._id,
        projectName: p.name,
        location: p.location,
        totalExpenses,
        totalPayments,
        profit: totalPayments - totalExpenses,
        overallProgress: p.overallProgress,
        status: p.status,
      };
    });

    const totalExpenses = expenseTotals[0]?.total || 0;
    const totalPaymentsReceived = paymentTotals[0]?.total || 0;

    res.json({
      success: true,
      data: {
        activeProjects,
        totalWorkers,
        todayPresent,
        attendanceRate: totalWorkers > 0 ? Math.round((todayPresent / totalWorkers) * 100) : 0,
        pendingPayroll: pendingPayroll[0]?.total || 0,
        pendingInvoices: pendingInvoices[0]?.total || 0,
        lowStockAlerts: lowStockMaterials,
        missingDPRsToday,
        recentDPRs,
        projects,
        totalExpenses,
        totalPaymentsReceived,
        profit: totalPaymentsReceived - totalExpenses,
        projectFinancials,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/analytics
const getAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // Last 6 months revenue
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Invoice.aggregate([
      { $match: { tenantId, status: "paid", invoiceDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$invoiceDate" }, month: { $month: "$invoiceDate" } },
          revenue: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Project performance
    const projectPerformance = await Project.find({ tenantId, status: "active" })
      .select("name budget amountSpent overallProgress")
      .limit(10);

    // Worker role distribution
    const workerDistribution = await Worker.aggregate([
      { $match: { tenantId, isActive: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: { monthlyRevenue, projectPerformance, workerDistribution },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardStats, getAnalytics };
