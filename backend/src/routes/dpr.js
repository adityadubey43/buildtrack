const express = require("express");
const router = express.Router();
const { getDPRs, getDPR, createDPR, updateDPR, getMissingDPRs } = require("../controllers/dprController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.get("/missing-today", getMissingDPRs);
router.route("/").get(getDPRs).post(authorize("admin", "engineer", "supervisor"), createDPR);
router.route("/:id").get(getDPR).put(authorize("admin", "engineer", "supervisor"), updateDPR);

module.exports = router;
