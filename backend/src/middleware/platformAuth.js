const jwt = require("jsonwebtoken");
const PlatformAdmin = require("../models/PlatformAdmin");

// Guards the BuildTrack platform console. Rejects ordinary tenant tokens —
// only tokens minted with scope:"platform" for an active PlatformAdmin pass.
const protectPlatform = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.scope !== "platform") {
      return res.status(403).json({ success: false, message: "Platform access required." });
    }
    const admin = await PlatformAdmin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: "Platform admin not found or deactivated." });
    }
    req.platformAdmin = admin;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
    next(err);
  }
};

const signPlatformToken = (adminId) =>
  jwt.sign({ id: adminId, scope: "platform" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

module.exports = { protectPlatform, signPlatformToken };
