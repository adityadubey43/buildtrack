const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Tenant = require("../models/Tenant");
const PaymentReceived = require("../models/PaymentReceived");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a value that may arrive as a JSON string (multipart) or already as an
 * array / object from a JSON body.
 */
function parseBodyArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Auto-generate an invoice number in the format INV-001, INV-002 … for this
 * tenant.  We count existing invoices (including cancelled/draft) so numbers
 * never repeat even after deletion.
 */
async function nextInvoiceNumber(tenantId, prefix = "INV") {
  const count = await Invoice.countDocuments({ tenantId, invoiceNumber: { $regex: `^${prefix}-` } });
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
}

/**
 * Derive GST type from the first two digits of the buyer and seller GSTINs.
 * If either is missing we fall back to "intra" (safest default).
 */
function deriveGstType(tenantGstin, clientGstin) {
  if (!tenantGstin || !clientGstin) return "intra";
  const sellerState = tenantGstin.substring(0, 2);
  const buyerState = clientGstin.substring(0, 2);
  return sellerState === buyerState ? "intra" : "inter";
}

/**
 * Core financial calculation.  All inputs come from validated/normalised
 * values; returns a plain object of computed fields ready to spread into the
 * Invoice doc.
 */
function calculateInvoiceTotals({
  items,
  discountType = "none",
  discountValue = 0,
  additionalCharges = [],
  tdsRate = 0,
  gstType = "intra",
}) {
  // 1. Per-item amounts (always recalculated from qty * rate)
  const normalizedItems = items.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    rate: Number(item.rate),
    amount: Number(item.quantity) * Number(item.rate),
    gstRate: item.gstRate != null ? Number(item.gstRate) : 18,
  }));

  // 2. Subtotal
  const subtotal = normalizedItems.reduce((sum, i) => sum + i.amount, 0);

  // 3. Discount
  let discountAmount = 0;
  if (discountType === "pct") {
    discountAmount = (subtotal * Number(discountValue)) / 100;
  } else if (discountType === "fixed") {
    discountAmount = Number(discountValue);
  }
  discountAmount = Math.min(discountAmount, subtotal); // can't exceed subtotal

  const taxableAmount = subtotal - discountAmount;

  // 4. Tax lines — group items by gstRate
  const rateGroups = {};
  for (const item of normalizedItems) {
    const rate = item.gstRate;
    if (!rateGroups[rate]) rateGroups[rate] = 0;
    // proportionally allocate discount to each item group
    const itemTaxable = item.amount - (subtotal > 0 ? (item.amount / subtotal) * discountAmount : 0);
    rateGroups[rate] += itemTaxable;
  }

  const taxLines = [];
  let totalTax = 0;

  for (const [rateStr, groupTaxable] of Object.entries(rateGroups)) {
    const gstRate = Number(rateStr);
    const line = { gstRate, taxableAmount: groupTaxable };

    if (gstType === "intra") {
      const halfRate = gstRate / 2;
      const halfAmount = (groupTaxable * halfRate) / 100;
      line.cgstRate = halfRate;
      line.cgstAmount = halfAmount;
      line.sgstRate = halfRate;
      line.sgstAmount = halfAmount;
      line.igstRate = 0;
      line.igstAmount = 0;
      totalTax += halfAmount * 2;
    } else {
      const igstAmount = (groupTaxable * gstRate) / 100;
      line.cgstRate = 0;
      line.cgstAmount = 0;
      line.sgstRate = 0;
      line.sgstAmount = 0;
      line.igstRate = gstRate;
      line.igstAmount = igstAmount;
      totalTax += igstAmount;
    }

    taxLines.push(line);
  }

  // 5. Additional charges
  const normalizedCharges = additionalCharges.map((c) => ({
    label: c.label,
    amount: Number(c.amount),
  }));
  const additionalChargesTotal = normalizedCharges.reduce((sum, c) => sum + c.amount, 0);

  // 6. TDS
  const tdsAmount = ((taxableAmount + totalTax) * Number(tdsRate)) / 100;

  // 7. Round-off (bring total to nearest rupee)
  const rawTotal = taxableAmount + totalTax + additionalChargesTotal - tdsAmount;
  const roundOff = Math.round(rawTotal) - rawTotal;
  const totalAmount = rawTotal + roundOff;

  return {
    items: normalizedItems,
    subtotal,
    discountAmount,
    taxableAmount,
    taxLines,
    totalTax,
    additionalCharges: normalizedCharges,
    additionalChargesTotal,
    tdsAmount,
    roundOff,
    totalAmount,
  };
}

/**
 * Build the company snapshot from a Tenant document.
 */
function buildCompanySnapshot(tenant) {
  const s = tenant.invoiceSettings || {};
  return {
    name: tenant.companyName,
    address: tenant.address,
    gstin: tenant.gstNumber,
    stateCode: s.stateCode,
    phone: tenant.phone,
    email: s.email,
    logo: s.logo || tenant.logo,
    bankName: s.bankName,
    accountNumber: s.accountNumber,
    ifsc: s.ifsc,
    accountHolder: s.accountHolder,
    upiId: s.upiId,
    signature: s.signature,
    pan: s.pan,
  };
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

// GET /api/invoices
const getInvoices = async (req, res, next) => {
  try {
    const { project, status, clientName } = req.query;
    const filter = { tenantId: req.tenantId };
    if (project) filter.project = project;
    if (status) filter.status = status;
    if (clientName) filter["client.name"] = { $regex: clientName, $options: "i" };

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

    // Merge live tenant invoiceSettings into the company snapshot so the
    // frontend always gets up-to-date bank/signature details.
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    const liveCompany = tenant ? buildCompanySnapshot(tenant) : {};
    const mergedCompany = { ...liveCompany, ...invoice.company?.toObject?.() };

    res.json({ success: true, data: { ...invoice.toObject(), company: mergedCompany } });
  } catch (err) {
    next(err);
  }
};

// GET /api/invoices/:id/print
const getInvoiceForPrint = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate("project", "name location clientName")
      .populate("createdBy", "name");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    const liveCompany = tenant ? buildCompanySnapshot(tenant) : {};
    // For print: live tenant data takes precedence (most current details)
    const mergedCompany = { ...invoice.company?.toObject?.(), ...liveCompany };

    res.json({ success: true, data: { ...invoice.toObject(), company: mergedCompany } });
  } catch (err) {
    next(err);
  }
};

// POST /api/invoices
const createInvoice = async (req, res, next) => {
  try {
    const {
      // Client
      client,
      // Invoice meta
      invoiceNumber: providedInvoiceNumber,
      invoiceDate,
      dueDate,
      // Project
      project,
      projectName: providedProjectName,
      siteName,
      siteLocation,
      workType,
      // Items
      items,
      // Discount
      discountType,
      discountValue,
      // GST override (optional — auto-detected if not provided)
      gstType: gstTypeOverride,
      // Additional charges
      additionalCharges,
      // TDS
      tdsRate,
      // Options
      reverseCharge,
      // Recurring
      recurring,
      milestone,
      // Content
      terms,
      notes,
      paymentInstructions,
      // Attachments
      attachments,
    } = req.body;

    // --- Validate required fields ---
    if (!client || !client.name) {
      return res.status(400).json({ success: false, message: "client.name is required." });
    }

    const invoiceItems = parseBodyArray(items);
    if (!invoiceItems || !Array.isArray(invoiceItems) || invoiceItems.length === 0) {
      return res.status(400).json({ success: false, message: "At least one invoice item is required." });
    }

    // Validate items
    const itemErrors = invoiceItems
      .map((item, i) => {
        if (!item || typeof item !== "object") return `Item ${i + 1} is invalid.`;
        if (!item.description || !String(item.description).trim()) return `Item ${i + 1}: description is required.`;
        const qty = Number(item.quantity);
        const rate = Number(item.rate);
        if (Number.isNaN(qty) || qty < 0) return `Item ${i + 1}: quantity must be >= 0.`;
        if (Number.isNaN(rate) || rate < 0) return `Item ${i + 1}: rate must be >= 0.`;
        if (item.gstRate !== undefined && ![0, 5, 12, 18, 28].includes(Number(item.gstRate))) {
          return `Item ${i + 1}: gstRate must be one of 0, 5, 12, 18, 28.`;
        }
        return null;
      })
      .filter(Boolean);

    if (itemErrors.length) {
      return res.status(400).json({ success: false, message: itemErrors.join(" ") });
    }

    // --- Fetch tenant for company snapshot + GST state code ---
    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });

    // --- Detect GST type ---
    const gstType =
      gstTypeOverride ||
      deriveGstType(tenant.gstNumber, client.gstin);

    // --- Snapshot project name ---
    let projectName = providedProjectName;
    if (project && !projectName) {
      const Project = mongoose.model("Project");
      const proj = await Project.findById(project).select("name").lean();
      if (proj) projectName = proj.name;
    }

    // --- Calculate all financials first (needed to decide invoice number prefix) ---
    const parsedAdditionalCharges = parseBodyArray(additionalCharges) || [];
    const calc = calculateInvoiceTotals({
      items: invoiceItems.map((item) => ({
        description: String(item.description).trim(),
        hsnCode: item.hsnCode,
        unit: item.unit || "nos",
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        gstRate: item.gstRate != null ? Number(item.gstRate) : 18,
      })),
      discountType: discountType || "none",
      discountValue: Number(discountValue) || 0,
      additionalCharges: parsedAdditionalCharges,
      tdsRate: Number(tdsRate) || 0,
      gstType,
    });

    // --- Auto-generate invoice number (BILL- prefix for zero-tax invoices) ---
    const isNonGst = calc.totalTax === 0;
    const invoiceNumber = providedInvoiceNumber || (await nextInvoiceNumber(req.tenantId, isNonGst ? "BILL" : "INV"));

    // --- Build company snapshot ---
    const company = buildCompanySnapshot(tenant);

    const invoiceData = {
      tenantId: req.tenantId,
      company,
      client: {
        name: client.name,
        address: client.address,
        gstin: client.gstin,
        stateCode: client.stateCode || (client.gstin ? client.gstin.substring(0, 2) : undefined),
        phone: client.phone,
        email: client.email,
      },
      invoiceNumber,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      project: project || undefined,
      projectName,
      siteName,
      siteLocation,
      workType: workType || "other",
      // Calculated
      ...calc,
      discountType: discountType || "none",
      discountValue: Number(discountValue) || 0,
      gstType,
      tdsRate: Number(tdsRate) || 0,
      reverseCharge: Boolean(reverseCharge),
      paidAmount: 0,
      balanceAmount: calc.totalAmount,
      status: "draft",
      // Recurring
      recurring: recurring || { type: "one-time" },
      milestone: milestone || (recurring && recurring.milestone) || undefined,
      // Backward-compat gstRate — use first item's rate or 18
      gstRate: invoiceItems[0] ? (invoiceItems[0].gstRate != null ? Number(invoiceItems[0].gstRate) : 18) : 18,
      // Content
      terms: terms || (tenant.invoiceSettings && tenant.invoiceSettings.defaultTerms) || undefined,
      notes,
      paymentInstructions:
        paymentInstructions ||
        (tenant.invoiceSettings && tenant.invoiceSettings.defaultPaymentInstructions) ||
        undefined,
      attachments: parseBodyArray(attachments) || [],
      createdBy: req.user._id,
    };

    const invoice = await Invoice.create(invoiceData);

    res.status(201).json({ success: true, message: "Invoice created.", data: invoice });
  } catch (err) {
    next(err);
  }
};

// PUT /api/invoices/:id
const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

    const hasPaymentHistory = invoice.paidAmount > 0 || invoice.payments.length > 0;

    if (hasPaymentHistory) {
      // After payment: only allow non-financial metadata updates
      const allowedAfterPayment = [
        "client", "notes", "terms", "paymentInstructions",
        "status", "milestone", "dueDate", "attachments",
        "siteName", "siteLocation", "workType",
      ];

      const updateData = {};
      for (const field of allowedAfterPayment) {
        if (field in req.body) updateData[field] = req.body[field];
      }

      const financialFields = ["items", "subtotal", "totalAmount", "taxLines", "discountType",
        "discountValue", "discountAmount", "taxableAmount", "totalTax", "tdsRate", "tdsAmount",
        "additionalCharges", "additionalChargesTotal", "roundOff", "paidAmount", "balanceAmount",
        "gstType", "gstRate"];
      const attempted = Object.keys(req.body).filter((k) => financialFields.includes(k));
      if (attempted.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot modify financial fields after payment has been recorded: ${attempted.join(", ")}`,
        });
      }

      const updated = await Invoice.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.tenantId },
        { $set: updateData },
        { new: true }
      ).populate("project", "name location").populate("createdBy", "name");

      return res.json({
        success: true,
        message: "Invoice updated. Payment history protected.",
        data: updated,
      });
    }

    // No payment history — allow full recalculation
    const {
      client, invoiceDate, dueDate, project, projectName, siteName, siteLocation, workType,
      items, discountType, discountValue, additionalCharges, tdsRate, gstType: gstTypeOverride,
      reverseCharge, recurring, milestone, terms, notes, paymentInstructions, attachments, status,
    } = req.body;

    let updateData = {};

    // Recalculate if financial fields are being changed
    const financialChange = items || discountType !== undefined || discountValue !== undefined ||
      additionalCharges || tdsRate !== undefined || gstTypeOverride;

    if (financialChange) {
      const tenant = await Tenant.findOne({ tenantId: req.tenantId });
      const effectiveItems = parseBodyArray(items) || invoice.items;
      const effectiveGstType =
        gstTypeOverride ||
        deriveGstType(
          tenant ? tenant.gstNumber : null,
          (client && client.gstin) || invoice.client.gstin
        );

      const calc = calculateInvoiceTotals({
        items: effectiveItems.map((item) => ({
          description: item.description,
          hsnCode: item.hsnCode,
          unit: item.unit || "nos",
          quantity: Number(item.quantity),
          rate: Number(item.rate),
          gstRate: item.gstRate != null ? Number(item.gstRate) : 18,
        })),
        discountType: discountType !== undefined ? discountType : invoice.discountType,
        discountValue: discountValue !== undefined ? Number(discountValue) : invoice.discountValue,
        additionalCharges: parseBodyArray(additionalCharges) || invoice.additionalCharges,
        tdsRate: tdsRate !== undefined ? Number(tdsRate) : invoice.tdsRate,
        gstType: effectiveGstType,
      });

      Object.assign(updateData, calc, {
        gstType: effectiveGstType,
        discountType: discountType !== undefined ? discountType : invoice.discountType,
        discountValue: discountValue !== undefined ? Number(discountValue) : invoice.discountValue,
        tdsRate: tdsRate !== undefined ? Number(tdsRate) : invoice.tdsRate,
        balanceAmount: calc.totalAmount,
      });
    }

    // Non-financial fields
    if (client) updateData.client = client;
    if (invoiceDate) updateData.invoiceDate = new Date(invoiceDate);
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (project !== undefined) updateData.project = project;
    if (projectName !== undefined) updateData.projectName = projectName;
    if (siteName !== undefined) updateData.siteName = siteName;
    if (siteLocation !== undefined) updateData.siteLocation = siteLocation;
    if (workType) updateData.workType = workType;
    if (reverseCharge !== undefined) updateData.reverseCharge = Boolean(reverseCharge);
    if (recurring) updateData.recurring = recurring;
    if (milestone !== undefined) updateData.milestone = milestone;
    if (terms !== undefined) updateData.terms = terms;
    if (notes !== undefined) updateData.notes = notes;
    if (paymentInstructions !== undefined) updateData.paymentInstructions = paymentInstructions;
    if (attachments) updateData.attachments = parseBodyArray(attachments);
    if (status) updateData.status = status;

    const updated = await Invoice.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: updateData },
      { new: true }
    ).populate("project", "name location").populate("createdBy", "name");

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// POST /api/invoices/:id/payment
const recordPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, date, mode, reference, notes } = req.body;
    const paymentAmount = Number(amount);
    const paymentDate = new Date(date);

    if (Number.isNaN(paymentAmount) || paymentAmount <= 0 || Number.isNaN(paymentDate.getTime())) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "A valid payment amount and date are required." });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId }).session(session);
    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    // Prevent overpayment
    const newPaidAmount = invoice.paidAmount + paymentAmount;
    if (newPaidAmount > invoice.totalAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Payment exceeds invoice total. Invoice total: ₹${invoice.totalAmount}, Already paid: ₹${invoice.paidAmount}, New payment: ₹${paymentAmount}. Maximum allowed: ₹${invoice.totalAmount - invoice.paidAmount}`,
      });
    }

    invoice.payments.push({ amount: paymentAmount, date: paymentDate, mode: mode || "bank", reference, notes });
    invoice.paidAmount = newPaidAmount;
    invoice.balanceAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);

    if (invoice.balanceAmount <= 0) {
      invoice.status = "paid";
    } else if (invoice.paidAmount > 0) {
      invoice.status = "partially-paid";
    }

    await invoice.save({ session });

    await PaymentReceived.create(
      [
        {
          tenantId: req.tenantId,
          project: invoice.project,
          clientName: invoice.client.name,
          invoice: invoice._id,
          amount: paymentAmount,
          date: paymentDate,
          paymentMode: mode || "bank",
          reference,
          milestone: invoice.milestone || (invoice.recurring && invoice.recurring.milestone),
          notes,
          recordedBy: req.user._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await invoice.populate("project", "name location").populate("createdBy", "name");
    res.json({ success: true, message: "Payment recorded.", data: invoice });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
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

module.exports = {
  getInvoices,
  getInvoice,
  getInvoiceForPrint,
  createInvoice,
  updateInvoice,
  recordPayment,
  getInvoiceSummary,
};
