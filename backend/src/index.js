require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Behind a platform proxy (Render/Vercel/etc.) so rate-limit & IPs work correctly
app.set("trust proxy", 1);

// ── Security & middleware ──
// Allow uploaded images/files to be loaded cross-origin
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Allow the configured frontend, localhost, and any Vercel/Netlify deployment URL
const exactOrigins = [process.env.CLIENT_URL, "http://localhost:3000", "http://localhost:3001"].filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl / server-to-server
    const ok =
      exactOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /\.netlify\.app$/.test(origin);
    return cb(null, ok || origin); // reflect known origins; token auth means this is safe
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many requests. Please try again after 15 minutes." },
});

// ── Static uploads ──
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── Routes ──
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/workers", require("./routes/workers"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/payroll", require("./routes/payroll"));
app.use("/api/dpr", require("./routes/dpr"));
app.use("/api/materials", require("./routes/materials"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/team", require("./routes/team"));
app.use("/api/equipment", require("./routes/equipment"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/platform", require("./routes/platform")); // BuildTrack super-admin console

// Razorpay routes (webhook uses raw body inline, others use JSON)
app.use("/api/razorpay", require("./routes/razorpay"));

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "BuildTrack API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// 404 handler
app.use("/{*path}", (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// Global error handler
app.use(errorHandler);

// ── MongoDB connection ──
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    family: 4,
  })
  .then(() => {
    console.log("✅ MongoDB Atlas connected");
    app.listen(PORT, () => {
      console.log(`🚀 BuildTrack API running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

module.exports = app;
