const express = require("express");
const router = express.Router();
const { getEquipment, createEquipment, updateEquipment, logMaintenance } = require("../controllers/equipmentController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.route("/").get(getEquipment).post(authorize("admin", "engineer"), createEquipment);
router.route("/:id").put(authorize("admin", "engineer"), updateEquipment);
router.post("/:id/maintenance", authorize("admin", "engineer", "supervisor"), logMaintenance);

module.exports = router;
