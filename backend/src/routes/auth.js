const express = require("express");
const router  = express.Router();
const { signup, login, getMe, forgotPassword, resetPassword, changePassword, getCompanyBySlug, getInvoiceSettings, updateInvoiceSettings, updateCompanyProfile } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/signup",         signup);
router.post("/login",          login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password",  resetPassword);
router.get("/company/:slug",   getCompanyBySlug);
router.get("/me",              protect, getMe);
router.put("/change-password", protect, changePassword);
router.get("/invoice-settings", protect, getInvoiceSettings);
router.put("/invoice-settings", protect, updateInvoiceSettings);
router.put("/company",          protect, updateCompanyProfile);

module.exports = router;
