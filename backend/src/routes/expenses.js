const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
} = require("../controllers/expenseController");

router.get("/summary", protect, getExpenseSummary);
router.get("/", protect, getExpenses);
router.post("/", protect, createExpense);
router.put("/:id", protect, updateExpense);
router.delete("/:id", protect, deleteExpense);

module.exports = router;
