const express = require("express");
const router = express.Router();
const { getMyWorker, getWorkers, getWorker, createWorker, updateWorker, deleteWorker } = require("../controllers/workerController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.get("/me", getMyWorker);
router.route("/").get(getWorkers).post(authorize("admin", "partner", "engineer"), createWorker);
router.route("/:id").get(getWorker).put(authorize("admin", "partner", "engineer", "supervisor"), updateWorker).delete(authorize("admin"), deleteWorker);

module.exports = router;
