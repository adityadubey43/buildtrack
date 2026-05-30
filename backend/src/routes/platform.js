const express = require("express");
const router = express.Router();
const { login, getMe, getStats, getCompanies, updateCompany } = require("../controllers/platformController");
const { protectPlatform } = require("../middleware/platformAuth");

// Public
router.post("/auth/login", login);

// Protected (platform admins only)
router.get("/auth/me", protectPlatform, getMe);
router.get("/stats", protectPlatform, getStats);
router.get("/companies", protectPlatform, getCompanies);
router.patch("/companies/:tenantId", protectPlatform, updateCompany);

module.exports = router;
