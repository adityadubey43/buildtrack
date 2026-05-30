const express = require("express");
const router = express.Router();
const { getInvoices, getInvoice, createInvoice, updateInvoice, recordPayment, getInvoiceSummary } = require("../controllers/invoiceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.get("/summary", getInvoiceSummary);
router.route("/").get(getInvoices).post(authorize("admin", "accountant"), createInvoice);
router.route("/:id").get(getInvoice).put(authorize("admin", "accountant"), updateInvoice);
router.post("/:id/payment", authorize("admin", "accountant"), recordPayment);

module.exports = router;
