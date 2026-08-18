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

// Module 6: invoice generation & approval. Same gate reuse rationale as
// /projects above — no new authenticate/authorizeRoles declaration
// needed.
router.get("/invoices/pending", pmInvoiceController.listPending);
router.patch("/invoices/:id", pmInvoiceController.review);

module.exports = router;
