const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");
const bcrypt = require("bcryptjs");

// GET /api/team
const getTeam = async (req, res, next) => {
  try {
    const { role, isActive = "true" } = req.query;
    const filter = { tenantId: req.tenantId };
    if (role) filter.role = role;
    if (isActive !== "all") filter.isActive = isActive === "true";

    const members = await User.find(filter)
      .populate("assignedSites", "name location")
      .sort({ createdAt: -1 });

    console.log("📋 Team members fetched:", {
      filter: filter,
      count: members.length,
      members: members.map(m => ({ name: m.name, email: m.email, role: m.role, isActive: m.isActive })),
    });

    res.json({ success: true, count: members.length, data: members });
  } catch (err) {
    next(err);
  }
};

// POST /api/team/invite — admin adds a new user to their tenant
const inviteMember = async (req, res, next) => {
  try {
    const { name, email, role, phone, assignedSites } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ success: false, message: "Name, email, and role are required." });
    }

    // Check for existing user within tenant
    const existing = await User.findOne({ tenantId: req.tenantId, email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "A team member with this email already exists." });
    }

    // Generate a temporary password
    const tempPassword = "Welcome@" + Math.floor(1000 + Math.random() * 9000);

    const user = await User.create({
      tenantId: req.tenantId,
      name, email: email.toLowerCase(),
      password: tempPassword,
      role, phone,
      assignedSites: assignedSites || [],
    });

    res.status(201).json({
      success: true,
      message: `Team member added. Temporary password: ${tempPassword}`,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/team/:id
const updateMember = async (req, res, next) => {
  try {
    const { name, role, phone, assignedSites, isActive } = req.body;
    const member = await User.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { name, role, phone, assignedSites, isActive },
      { new: true, runValidators: true }
    );
    if (!member) return res.status(404).json({ success: false, message: "Team member not found." });
    res.json({ success: true, message: "Member updated.", data: member });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/team/:id (soft deactivate)
const removeMember = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot remove yourself." });
    }
    const member = await User.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { isActive: false },
      { new: true }
    );
    if (!member) return res.status(404).json({ success: false, message: "Team member not found." });
    res.json({ success: true, message: "Team member deactivated." });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTeam, inviteMember, updateMember, removeMember };
