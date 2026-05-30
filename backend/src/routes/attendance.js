const express = require("express");
const router = express.Router();
const {
  getAttendance, getAttendanceSummary, markAttendance, updateAttendance,
  deleteAttendance, getWeeklySummary, getMonthlySummary, checkIn, checkOut, getMyToday,
} = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.get("/me/today", getMyToday);
router.get("/summary", getAttendanceSummary);
router.get("/weekly-summary", getWeeklySummary);
router.get("/monthly-summary", getMonthlySummary);

// Staff self-service check-in / check-out (self by default; admin/accountant may pass a worker id)
router.post("/checkin", checkIn);
router.post("/checkout", checkOut);

router.route("/").get(getAttendance).post(authorize("admin", "engineer", "supervisor", "accountant"), markAttendance);
router.route("/:id")
  .put(authorize("admin", "engineer", "supervisor", "accountant"), updateAttendance)
  .delete(authorize("admin", "engineer", "supervisor"), deleteAttendance);

module.exports = router;
