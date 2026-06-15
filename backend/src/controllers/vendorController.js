const Vendor     = require("../models/Vendor");
const VendorBill = require("../models/VendorBill");
const Expense    = require("../models/Expense");
const mongoose   = require("mongoose");

// GET /api/vendors
const getVendors = async (req, res, next) => {
  try {
    const vendors = await Vendor.find({ tenantId: req.tenantId }).sort({ name: 1 });
    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (err) { next(err); }
};

// POST /api/vendors
const createVendor = async (req, res, next) => {
  try {
    const { phone, gstNumber, address, notes } = req.body;
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Vendor name is required." });

    const exists = await Vendor.findOne({ tenantId: req.tenantId, name: { $regex: `^${name}$`, $options: "i" } });
    if (exists) return res.status(409).json({ success: false, message: "A vendor with this name already exists.", data: exists });

    const vendor = await Vendor.create({ tenantId: req.tenantId, name, phone, gstNumber, address, notes });
    res.status(201).json({ success: true, message: "Vendor created.", data: vendor });
  } catch (err) { next(err); }
};

// DELETE /api/vendors/:id
const deleteVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found." });
    res.json({ success: true, message: "Vendor deleted." });
  } catch (err) { next(err); }
};

// PUT /api/vendors/:id
const updateVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true }
    );
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found." });
    res.json({ success: true, data: vendor });
  } catch (err) { next(err); }
};

// POST /api/vendors/:id/bills  — record a vendor bill (what vendor charged you)
const addVendorBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findOne({ _id: id, tenantId: req.tenantId });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found." });

    const { amount, date, description, invoiceNumber, project, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Amount is required." });

    const bill = await VendorBill.create({
      tenantId: req.tenantId,
      vendorId: id,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      description, invoiceNumber, notes,
      project: project || null,
      recordedBy: req.user._id,
    });

    await bill.populate([
      { path: "project", select: "name" },
      { path: "recordedBy", select: "name" },
    ]);

    res.status(201).json({ success: true, message: "Bill recorded.", data: bill });
  } catch (err) { next(err); }
};

// DELETE /api/vendors/bills/:billId
const deleteVendorBill = async (req, res, next) => {
  try {
    const bill = await VendorBill.findOneAndDelete({ _id: req.params.billId, tenantId: req.tenantId });
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found." });
    res.json({ success: true, message: "Bill deleted." });
  } catch (err) { next(err); }
};

// GET /api/vendors/:id/ledger
// Bills (from vendor) = what was charged  →  totalBilled
// Expenses linked to vendor = what was paid out  →  totalPaid
const getVendorLedger = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "Invalid vendor ID." });

    const vendor = await Vendor.findOne({ _id: id, tenantId: req.tenantId });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found." });

    const [bills, expenses] = await Promise.all([
      VendorBill.find({ tenantId: req.tenantId, vendorId: id })
        .populate("project", "name")
        .sort({ date: -1 }),
      Expense.find({ tenantId: req.tenantId, vendorId: id })
        .populate("project", "name location")
        .sort({ date: -1 }),
    ]);

    const totalBilled = bills.reduce((s, b) => s + b.amount, 0);
    const totalPaid   = expenses.reduce((s, e) => s + e.amount, 0);
    const outstanding = totalBilled - totalPaid;

    res.json({
      success: true,
      data: {
        vendor,
        bills,
        expenses,
        summary: { totalBilled, totalPaid, outstanding },
      },
    });
  } catch (err) { next(err); }
};

// GET /api/vendors/summary
const getVendorsSummary = async (req, res, next) => {
  try {
    const vendors = await Vendor.find({ tenantId: req.tenantId }).sort({ name: 1 });

    const [billAgg, paidAgg] = await Promise.all([
      // totalBilled = sum of VendorBill amounts
      VendorBill.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: "$vendorId", totalBilled: { $sum: "$amount" }, billCount: { $sum: 1 }, lastDate: { $max: "$date" } } },
      ]),
      // totalPaid = sum of Expense amounts linked to vendors
      Expense.aggregate([
        { $match: { tenantId: req.tenantId, vendorId: { $ne: null } } },
        { $group: { _id: "$vendorId", totalPaid: { $sum: "$amount" }, expenseCount: { $sum: 1 } } },
      ]),
    ]);

    const billMap = Object.fromEntries(billAgg.map((r) => [r._id.toString(), r]));
    const paidMap = Object.fromEntries(paidAgg.map((r) => [r._id.toString(), r]));

    const data = vendors.map((v) => {
      const b = billMap[v._id.toString()] || { totalBilled: 0, billCount: 0, lastDate: null };
      const p = paidMap[v._id.toString()] || { totalPaid: 0, expenseCount: 0 };
      return {
        ...v.toObject(),
        totalBilled:  b.totalBilled,
        totalPaid:    p.totalPaid,
        outstanding:  b.totalBilled - p.totalPaid,
        billCount:    b.billCount,
        expenseCount: p.expenseCount,
        lastDate:     b.lastDate,
      };
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// POST /api/vendors/migrate
// Creates Vendor docs from unique vendor strings in existing expenses.
// Expenses = payments already made, so no bill is auto-created.
const migrateVendorStrings = async (req, res, next) => {
  try {
    const expenses = await Expense.find({ tenantId: req.tenantId, vendor: { $exists: true, $ne: "" }, vendorId: null });

    // Build a map of lowercase name → canonical vendor id
    const nameMap = new Map(); // lowercase key → vendor _id
    let created = 0, linked = 0;

    for (const e of expenses) {
      if (!e.vendor) continue;
      const key = e.vendor.trim().toLowerCase();
      if (nameMap.has(key)) continue;

      // Case-insensitive lookup so "Sarwan ram" and "Sarwan Ram" resolve to same doc
      let v = await Vendor.findOne({ tenantId: req.tenantId, name: { $regex: `^${e.vendor.trim()}$`, $options: "i" } });
      if (!v) { v = await Vendor.create({ tenantId: req.tenantId, name: e.vendor.trim() }); created++; }
      nameMap.set(key, v._id);
    }

    for (const e of expenses) {
      if (!e.vendor) continue;
      const vendorId = nameMap.get(e.vendor.trim().toLowerCase());
      if (vendorId) { e.vendorId = vendorId; await e.save(); linked++; }
    }

    res.json({ success: true, message: `Migration done. Created ${created} vendors, linked ${linked} expense payments.` });
  } catch (err) { next(err); }
};

module.exports = {
  getVendors, createVendor, updateVendor, deleteVendor,
  addVendorBill, deleteVendorBill,
  getVendorLedger, getVendorsSummary,
  migrateVendorStrings,
};
