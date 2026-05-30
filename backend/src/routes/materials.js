const express = require("express");
const router = express.Router();
const { getMaterials, createMaterial, updateMaterial, addTransaction, getTransactions } = require("../controllers/materialController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.route("/").get(getMaterials).post(authorize("admin", "engineer"), createMaterial);
router.route("/:id").put(authorize("admin", "engineer"), updateMaterial);
router.route("/:id/transactions").get(getTransactions).post(authorize("admin", "engineer", "supervisor"), addTransaction);

module.exports = router;
