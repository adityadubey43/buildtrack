const Invoice = require("../models/Invoice");
const { generateInvoiceNumber } = require("../utils/generateToken");

// GET /api/invoices
const getInvoices = async (req, res, next) => {
  try {
    const { project, status, clientName } = req.query;
    const filter = { tenantId: req.tenantId };
    if (project) filter.project = project;
    if (status) filter.status = status;
    if (clientName) filter.clientName = { $regex: clientName, $options: "i" };

    const invoices = await Invoice.find(filter)
      .populate("project", "name location")
      .populate("createdBy", "name")
      .sort({ invoiceDate: -1 });

    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (err) {
    next(err);
  }
};

// GET /api/invoices/:id
const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate("project", "name location clientName")
      .populate("createdBy", "name");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// POST /api/invoices
const createInvoice = async (req, res, next) => {
  try {
    const {
      project, clientName, clientAddress, clientGST,
      milestone, items, gstRate = 18,
      invoiceDate, dueDate, notes,
    } = req.body;

    if (!project || !clientName || !items || items.length === 0 || !invoiceDate || !dueDate) {
      return res.status(400).json({ success: false, message: "Project, client, items, invoice date, and due date are required." });
    }

    // Auto-number invoice
    const count = await Invoice.countDocuments({ tenantId: req.tenantId });
    const invoiceNumber = generateInvoiceNumber(req.tenantId, count);

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const gstAmount = Math.round(subtotal * (gstRate / 100));
    const totalAmount = subtotal + gstAmount;

    const invoice = await Invoice.create({
      tenantId: req.tenantId,
      invoiceNumber, project, clientName, clientAddress, clientGST,
      milestone, items,
      subtotal, gstRate, gstAmount, totalAmount,
      balanceAmount: totalAmount,
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      status: "draft", notes,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: "Invoice created.", data: invoice });
  } catch (err) {
    next(err);
  }
};

// PUT /api/invoices/:id
const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// POST /api/invoices/:id/payment
const recordPayment = async (req, res, next) => {
  try {
    const { amount, date, mode, reference, notes } = req.body;
    if (!amount || !date) {
      return res.status(400).json({ success: false, message: "Amount and date are required." });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

    invoice.payments.push({ amount: Number(amount), date: new Date(date), mode, reference, notes });
    invoice.paidAmount += Number(amount);
    invoice.balanceAmount = invoice.totalAmount - invoice.paidAmount;

    if (invoice.balanceAmount <= 0) {
      invoice.status = "paid";
    } else if (invoice.paidAmount > 0) {
      invoice.status = "partially-paid";
    }

    await invoice.save();
    res.json({ success: true, message: "Payment recorded.", data: invoice });
  } catch (err) {
    next(err);
  }
};

// GET /api/invoices/summary
const getInvoiceSummary = async (req, res, next) => {
  try {
    const result = await Invoice.aggregate([
      { $match: { tenantId: req.tenantId } },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = { total: 0, paid: 0, pending: 0, overdue: 0, count: {} };
    for (const r of result) {
      summary.count[r._id] = r.count;
      summary.total += r.total;
      if (r._id === "paid") summary.paid = r.total;
      else if (r._id === "overdue") summary.overdue += r.total;
      else summary.pending += r.total;
    }

    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
};

module.exports = { getInvoices, getInvoice, createInvoice, updateInvoice, recordPayment, getInvoiceSummary };
