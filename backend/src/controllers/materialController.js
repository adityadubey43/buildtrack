const { Material, MaterialTransaction } = require("../models/Material");

// GET /api/materials
const getMaterials = async (req, res, next) => {
  try {
    const { project, category, lowStock } = req.query;
    const filter = { tenantId: req.tenantId };
    if (project) filter.project = project;
    if (category) filter.category = category;
    if (lowStock === "true") filter.$expr = { $lte: ["$currentStock", "$minimumStock"] };

    const materials = await Material.find(filter)
      .populate("project", "name location")
      .sort({ name: 1 });

    res.json({ success: true, count: materials.length, data: materials });
  } catch (err) {
    next(err);
  }
};

// POST /api/materials
const createMaterial = async (req, res, next) => {
  try {
    const { name, category, unit, currentStock, minimumStock, project, vendor, vendorPhone, lastPurchasePrice } = req.body;
    if (!name || !unit) {
      return res.status(400).json({ success: false, message: "Name and unit are required." });
    }
    const material = await Material.create({
      tenantId: req.tenantId,
      name, category, unit,
      currentStock: Number(currentStock) || 0,
      minimumStock: Number(minimumStock) || 0,
      project, vendor, vendorPhone,
      lastPurchasePrice: Number(lastPurchasePrice) || 0,
    });
    res.status(201).json({ success: true, message: "Material added.", data: material });
  } catch (err) {
    next(err);
  }
};

// PUT /api/materials/:id
const updateMaterial = async (req, res, next) => {
  try {
    const material = await Material.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true }
    );
    if (!material) return res.status(404).json({ success: false, message: "Material not found." });
    res.json({ success: true, data: material });
  } catch (err) {
    next(err);
  }
};

// POST /api/materials/:id/transaction — record purchase or usage
const addTransaction = async (req, res, next) => {
  try {
    const { type, quantity, rate, vendor, invoiceNumber, project, date, notes } = req.body;
    if (!type || !quantity) {
      return res.status(400).json({ success: false, message: "Type and quantity are required." });
    }

    const material = await Material.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!material) return res.status(404).json({ success: false, message: "Material not found." });

    // Update stock
    if (type === "purchase" || type === "return") {
      material.currentStock += Number(quantity);
      if (rate) material.lastPurchasePrice = Number(rate);
      material.lastOrderDate = new Date();
    } else if (type === "usage" || type === "transfer") {
      if (material.currentStock < Number(quantity)) {
        return res.status(400).json({ success: false, message: "Insufficient stock." });
      }
      material.currentStock -= Number(quantity);
    }

    material.stockAlertSent = false;
    await material.save();

    const transaction = await MaterialTransaction.create({
      tenantId: req.tenantId,
      material: material._id,
      project, type,
      quantity: Number(quantity),
      unit: material.unit,
      rate: Number(rate) || 0,
      totalCost: (Number(rate) || 0) * Number(quantity),
      vendor, invoiceNumber,
      date: date ? new Date(date) : new Date(),
      recordedBy: req.user._id,
      notes,
    });

    res.status(201).json({ success: true, message: "Transaction recorded.", data: { material, transaction } });
  } catch (err) {
    next(err);
  }
};

// GET /api/materials/:id/transactions
const getTransactions = async (req, res, next) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!material) return res.status(404).json({ success: false, message: "Material not found." });

    const transactions = await MaterialTransaction.find({ material: req.params.id, tenantId: req.tenantId })
      .populate("project", "name")
      .populate("recordedBy", "name")
      .sort({ date: -1 });

    res.json({ success: true, data: transactions });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMaterials, createMaterial, updateMaterial, addTransaction, getTransactions };
