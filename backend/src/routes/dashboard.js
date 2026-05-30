const express = require("express");
const router = express.Router();
const { getDashboardStats, getAnalytics } = require("../controllers/dashboardController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/stats", getDashboardStats);
router.get("/analytics", getAnalytics);

module.exports = router;
