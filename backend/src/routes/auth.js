const express = require("express");
const router = express.Router();
const { signup, login, getMe, forgotPassword, changePassword, getCompanyBySlug } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.get("/company/:slug", getCompanyBySlug); // public — branding for company login page
router.get("/me", protect, getMe);
router.put("/change-password", protect, changePassword);

module.exports = router;
