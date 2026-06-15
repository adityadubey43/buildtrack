const Vendor  = require("../models/Vendor");
const Expense = require("../models/Expense");
const mongoose = require("mongoose");

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
    const { name, phone, gstNumber, address, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Vendor name is required." });

    // Prevent exact-name duplicates within same tenant
    const exists = await Vendor.findOne({ tenantId: req.tenantId, name: name.trim() });
    if (exists) return res.status(409).json({ success: false, message: "A vendor with this name already exists.", data: exists });

    const vendor = await Vendor.create({ tenantId: req.tenantId, name, phone, gstNumber, address, notes });
    res.status(201).json({ success: true, message: "Vendor created.", data: vendor });
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

// GET /api/vendors/:id/ledger
// Returns all expenses linked to this vendor with running totals
const getVendorLedger = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "Invalid vendor ID." });

    const vendor = await Vendor.findOne({ _id: id, tenantId: req.tenantId });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found." });

    const expenses = await Expense.find({ tenantId: req.tenantId, vendorId: id })
      .populate("project", "name location")
      .sort({ date: -1 });

    const totalBilled = expenses.reduce((s, e) => s + e.amount, 0);
    const totalPaid   = expenses.reduce((s, e) => s + (e.paidAmount || 0), 0);
    const outstanding = totalBilled - totalPaid;

    res.json({
      success: true,
      data: {
        vendor,
        expenses,
        summary: { totalBilled, totalPaid, outstanding },
      },
    });
  } catch (err) { next(err); }
};

// GET /api/vendors/summary — all vendors with their totals (for the list page)
const getVendorsSummary = async (req, res, next) => {
  try {
    const vendors = await Vendor.find({ tenantId: req.tenantId }).sort({ name: 1 });

    // Aggregate totals per vendorId in one query
    const agg = await Expense.aggregate([
      { $match: { tenantId: req.tenantId, vendorId: { $ne: null } } },
      {
        $group: {
          _id: "$vendorId",
          totalBilled: { $sum: "$amount" },
          totalPaid:   { $sum: "$paidAmount" },
          count:       { $sum: 1 },
          lastDate:    { $max: "$date" },
        },
      },
    ]);

    const aggMap = Object.fromEntries(agg.map((r) => [r._id.toString(), r]));

    const data = vendors.map((v) => {
      const a = aggMap[v._id.toString()] || { totalBilled: 0, totalPaid: 0, count: 0, lastDate: null };
      return {
        ...v.toObject(),
        totalBilled: a.totalBilled,
        totalPaid:   a.totalPaid,
        outstanding: a.totalBilled - a.totalPaid,
        expenseCount: a.count,
        lastDate:    a.lastDate,
      };
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// POST /api/vendors/migrate-from-strings
// One-shot: creates Vendor docs from unique vendor strings in existing expenses
const migrateVendorStrings = async (req, res, next) => {
  try {
    const expenses = await Expense.find({ tenantId: req.tenantId, vendor: { $exists: true, $ne: "" }, vendorId: null });

    const nameMap = new Map();
    for (const e of expenses) {
      if (e.vendor && !nameMap.has(e.vendor)) {
        nameMap.set(e.vendor, null);
      }
    }

    let created = 0;
    let linked = 0;
    for (const [name] of nameMap) {
      let v = await Vendor.findOne({ tenantId: req.tenantId, name });
      if (!v) {
        v = await Vendor.create({ tenantId: req.tenantId, name });
        created++;
      }
      nameMap.set(name, v._id);
    }

    for (const e of expenses) {
      if (e.vendor && nameMap.get(e.vendor)) {
        e.vendorId = nameMap.get(e.vendor);
        // Old expenses were already paid — treat full amount as paid
        if (!e.paidAmount || e.paidAmount === 0) {
          e.paidAmount = e.amount;
        }
        await e.save();
        linked++;
      }
    }

    res.json({ success: true, message: `Migration done. Created ${created} vendors, linked ${linked} expenses.` });
  } catch (err) { next(err); }
};

module.exports = { getVendors, createVendor, updateVendor, getVendorLedger, getVendorsSummary, migrateVendorStrings };
