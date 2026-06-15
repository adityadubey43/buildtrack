const express = require("express");
const router  = express.Router();
const { protect } = require("../middleware/auth");
const {
  getVendors,
  createVendor,
  updateVendor,
  getVendorLedger,
  getVendorsSummary,
  migrateVendorStrings,
} = require("../controllers/vendorController");

router.get("/summary",        protect, getVendorsSummary);
router.post("/migrate",       protect, migrateVendorStrings);
router.get("/",               protect, getVendors);
router.post("/",              protect, createVendor);
router.put("/:id",            protect, updateVendor);
router.get("/:id/ledger",     protect, getVendorLedger);

module.exports = router;
