const express = require("express");
const router = express.Router();
const { getTeam, inviteMember, updateMember, removeMember } = require("../controllers/teamController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.route("/").get(getTeam).post(authorize("admin"), inviteMember);
router.route("/:id").put(authorize("admin"), updateMember).delete(authorize("admin"), removeMember);

module.exports = router;
