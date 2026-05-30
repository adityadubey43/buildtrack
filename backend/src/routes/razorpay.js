const express = require("express");
const router = express.Router();
const { health, createSubscription, createOrder, verifyAndSignup, activateSubscription, webhook } = require("../controllers/razorpayController");
const { protect } = require("../middleware/auth");

// Public
router.get("/health", health);
router.post("/create-subscription", createSubscription);
router.post("/create-order", createOrder);          // yearly one-time charge
router.post("/verify-and-signup", verifyAndSignup);

// Protected (logged-in user activating from dashboard)
router.post("/activate-subscription", protect, activateSubscription);

// Webhook — needs raw body for HMAC signature verification
router.post("/webhook", express.raw({ type: "*/*" }), webhook);

module.exports = router;
