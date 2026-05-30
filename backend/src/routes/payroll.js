const express = require("express");
const router = express.Router();
const { getPayrolls, getPayroll, calculatePayroll, processPayment, deletePayroll } = require("../controllers/payrollController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.get("/", getPayrolls);
router.get("/:id", getPayroll);
router.post("/calculate", authorize("admin", "accountant"), calculatePayroll);
router.put("/:id/pay", authorize("admin", "accountant"), processPayment);
router.delete("/:id", authorize("admin", "accountant"), deletePayroll);

module.exports = router;
