const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const contractorProjectController = require("../controllers/contractorProjectController");
const contractorProfileController = require("../controllers/contractorProfileController");
const contractorTimesheetController = require("../controllers/contractorTimesheetController");

/**
 * Every route here requires a valid JWT AND role = CONTRACTOR — same
 * gate pattern as routes/vendorRoutes.js and routes/pmRoutes.js.
 */
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.CONTRACTOR));

router.get("/projects", contractorProjectController.list);

// Module 3 revision: a contractor viewing/updating their own primary
// skill. Lives in this router (rather than a new file) so it reuses
// exactly the same authenticate + authorizeRoles(CONTRACTOR) gate above.
// Vendor-centric workflow revision renamed the update route to
// PATCH /profile/skill (explicit about WHAT it updates, since profile
// could grow other fields later); GET /profile is unchanged.
router.get("/profile", contractorProfileController.getProfile);
router.patch("/profile/skill", contractorProfileController.updateProfile);

// Module 4 (daily logging revision): a contractor logging individual
// days worked against a project they are assigned to, viewing their own
// submission history, and editing a REJECTED day back to PENDING. Same
// gate reuse rationale as /profile above — no new
// authenticate/authorizeRoles declaration needed.
router.post("/timesheets", contractorTimesheetController.submit);
router.get("/timesheets", contractorTimesheetController.list);
router.patch("/timesheets/:id", contractorTimesheetController.update);

module.exports = router;
