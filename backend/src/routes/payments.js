const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getPayments,
  getPaymentSummary,
  createPayment,
  updatePayment,
  deletePayment,
} = require("../controllers/paymentController");

router.get("/summary", protect, getPaymentSummary);
router.get("/", protect, getPayments);
router.post("/", protect, createPayment);
router.put("/:id", protect, updatePayment);
router.delete("/:id", protect, deletePayment);

module.exports = router;
