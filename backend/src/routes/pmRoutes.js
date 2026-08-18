const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const pmProjectController = require("../controllers/pmProjectController");
const pmTimesheetController = require("../controllers/pmTimesheetController");
const pmMilestoneController = require("../controllers/pmMilestoneController");
const pmInvoiceController = require("../controllers/pmInvoiceController");

/**
 * Every route here requires a valid JWT AND role = PM — same gate
 * pattern as routes/vendorRoutes.js.
 */
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.PM));

router.post("/projects", pmProjectController.create);
router.get("/projects", pmProjectController.list);
// Module 5 addition: contractors assigned to one of this PM's own
// projects, powering the milestone-creation contractor picker.
router.get("/projects/:id/contractors", pmProjectController.listContractors);
// Project hours/allocation redesign addition: PM marks a project
// COMPLETED, auto-releasing every active assignment on it.
router.patch("/projects/:id/complete", pmProjectController.complete);
// MVP fix 1: the PM (never the Vendor) sets/changes a specific,
// already-assigned contractor's work-hour allocation on this project.
router.patch(
  "/projects/:projectId/contractors/:contractorId/allocation",
  pmProjectController.allocateHours
);

// Module 4: reviewing timesheets submitted against this PM's own
// projects. Same gate reuse rationale as /projects above — no new
// authenticate/authorizeRoles declaration needed.
router.get("/timesheets/pending", pmTimesheetController.listPending);
router.patch("/timesheets/:id", pmTimesheetController.review);

// Module 5: milestone & billing engine. Same gate reuse rationale as
// /projects above — no new authenticate/authorizeRoles declaration
// needed.
router.post("/milestones", pmMilestoneController.create);
router.get("/milestones/:projectId", pmMilestoneController.listForProject);

// Module 6, narrowed by the invoice-workflow redesign: read-only invoice
// HISTORY for this PM's own projects — approval moved to the Vendor (see
// routes/vendorRoutes.js's PATCH /invoices/:id). There is no PM-side
// mutation route anymore. Same gate reuse rationale as /projects above —
// no new authenticate/authorizeRoles declaration needed.
router.get("/invoices", pmInvoiceController.list);

module.exports = router;
