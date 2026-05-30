const express = require("express");
const router = express.Router();
const { createSubscription, verifyAndSignup, webhook, getConfig } = require("../controllers/razorpayController");

// Public — no auth required
router.get("/config", getConfig);
router.post("/create-subscription", createSubscription);
router.post("/verify-and-signup", verifyAndSignup);

// Webhook — raw body required for signature verification (mounted separately in index.js)
router.post("/webhook", webhook);

module.exports = router;
