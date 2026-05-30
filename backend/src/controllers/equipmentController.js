const Equipment = require("../models/Equipment");

// GET /api/equipment
const getEquipment = async (req, res, next) => {
  try {
    const { status, project } = req.query;
    const filter = { tenantId: req.tenantId };
    if (status) filter.status = status;
    if (project) filter.assignedProject = project;

    const equipment = await Equipment.find(filter)
      .populate("assignedProject", "name location")
      .sort({ name: 1 });

    res.json({ success: true, count: equipment.length, data: equipment });
  } catch (err) {
    next(err);
  }
};

// POST /api/equipment
const createEquipment = async (req, res, next) => {
  try {
    const {
      name, type, model, ownershipType, rentalRate,
      assignedProject, purchaseDate, purchaseCost, notes,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: "Name and type are required." });
    }

    const eq = await Equipment.create({
      tenantId: req.tenantId,
      name, type, model, ownershipType,
      rentalRate: Number(rentalRate) || 0,
      assignedProject, purchaseDate,
      purchaseCost: Number(purchaseCost) || 0,
      notes,
    });

    res.status(201).json({ success: true, message: "Equipment added.", data: eq });
  } catch (err) {
    next(err);
  }
};

// PUT /api/equipment/:id
const updateEquipment = async (req, res, next) => {
  try {
    const eq = await Equipment.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true }
    );
    if (!eq) return res.status(404).json({ success: false, message: "Equipment not found." });
    res.json({ success: true, data: eq });
  } catch (err) {
    next(err);
  }
};

// POST /api/equipment/:id/maintenance
const logMaintenance = async (req, res, next) => {
  try {
    const { date, type, description, cost, performedBy, nextDueDate } = req.body;
    const eq = await Equipment.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!eq) return res.status(404).json({ success: false, message: "Equipment not found." });

    eq.maintenanceLogs.push({ date: new Date(date), type, description, cost: Number(cost) || 0, performedBy, nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined });
    eq.lastMaintenanceDate = new Date(date);
    if (nextDueDate) eq.nextMaintenanceDate = new Date(nextDueDate);
    if (eq.status === "maintenance") eq.status = "active";

    await eq.save();
    res.json({ success: true, message: "Maintenance logged.", data: eq });
  } catch (err) {
    next(err);
  }
};

module.exports = { getEquipment, createEquipment, updateEquipment, logMaintenance };
