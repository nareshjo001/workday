const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const pmProjectController = require("../controllers/pmProjectController");
const pmTimesheetController = require("../controllers/pmTimesheetController");

/**
 * Every route here requires a valid JWT AND role = PM — same gate
 * pattern as routes/vendorRoutes.js.
 */
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.PM));

router.post("/projects", pmProjectController.create);
router.get("/projects", pmProjectController.list);

// Module 4: reviewing timesheets submitted against this PM's own
// projects. Same gate reuse rationale as /projects above — no new
// authenticate/authorizeRoles declaration needed.
router.get("/timesheets/pending", pmTimesheetController.listPending);
router.patch("/timesheets/:id", pmTimesheetController.review);

module.exports = router;
