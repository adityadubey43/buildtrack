const express = require("express");
const router = express.Router();
const { getProjects, getProject, createProject, updateProject, updatePhase, deleteProject, getProjectStats } = require("../controllers/projectController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/stats", getProjectStats);
router.route("/").get(getProjects).post(authorize("admin", "partner", "engineer"), createProject);
router.route("/:id").get(getProject).put(authorize("admin", "partner", "engineer"), updateProject).delete(authorize("admin"), deleteProject);
router.put("/:id/phase", authorize("admin", "partner", "engineer"), updatePhase);

module.exports = router;
