const express = require("express");
const router  = express.Router();
const { protect } = require("../middleware/auth");
const {
  getVendors, createVendor, updateVendor, deleteVendor,
  addVendorBill, deleteVendorBill,
  getVendorLedger, getVendorsSummary,
  migrateVendorStrings,
} = require("../controllers/vendorController");

router.get("/summary",              protect, getVendorsSummary);
router.post("/migrate",             protect, migrateVendorStrings);
router.delete("/bills/:billId",     protect, deleteVendorBill);
router.get("/",                     protect, getVendors);
router.post("/",                    protect, createVendor);
router.put("/:id",                  protect, updateVendor);
router.delete("/:id",               protect, deleteVendor);
router.get("/:id/ledger",           protect, getVendorLedger);
router.post("/:id/bills",           protect, addVendorBill);

module.exports = router;
