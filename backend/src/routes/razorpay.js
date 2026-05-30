const express = require("express");
const router = express.Router();
const { createSubscription, verifyAndSignup, activateSubscription, webhook, getConfig, healthCheck } = require("../controllers/razorpayController");
const { protect } = require("../middleware/auth");

// Public — no auth required (signup flow)
router.get("/config", getConfig);
router.get("/health", healthCheck);
router.post("/create-subscription", createSubscription);
router.post("/verify-and-signup", verifyAndSignup);

// Protected — existing logged-in user activating subscription from dashboard
router.post("/activate-subscription", protect, activateSubscription);

// Webhook — raw body required for signature verification (mounted separately in index.js)
router.post("/webhook", webhook);

module.exports = router;
