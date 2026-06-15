const express = require("express");
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  getInvoiceForPrint,
  createInvoice,
  updateInvoice,
  recordPayment,
  getInvoiceSummary,
  deleteInvoice,
} = require("../controllers/invoiceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.get("/summary", getInvoiceSummary);
router.route("/").get(getInvoices).post(authorize("admin", "accountant"), createInvoice);
router.get("/:id/print", getInvoiceForPrint);
router.route("/:id").get(getInvoice).put(authorize("admin", "accountant"), updateInvoice).delete(authorize("admin"), deleteInvoice);
router.post("/:id/payment", authorize("admin", "accountant"), recordPayment);

module.exports = router;
