const express = require("express");
const rateLimit = require("express-rate-limit");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const pmProjectController = require("../controllers/pmProjectController");
const pmTimesheetController = require("../controllers/pmTimesheetController");
const pmMilestoneController = require("../controllers/pmMilestoneController");
const pmInvoiceController = require("../controllers/pmInvoiceController");
const pmDashboardController = require("../controllers/pmDashboardController");
const pmContractorDocumentController = require("../controllers/pmContractorDocumentController");
const pmVendorAccessController = require("../controllers/pmVendorAccessController");
const authController = require("../controllers/authController");
const candidateSubmissionController = require("../controllers/candidateSubmissionController");
const staffingPipelineController = require("../controllers/staffingPipelineController");
const notificationController = require("../controllers/notificationController");
const invoiceLifecycleController = require("../controllers/invoiceLifecycleController");
const dashboardExportController = require('../controllers/dashboardExportController');
const pmProjectControlController = require("../controllers/pmProjectControlController");
const auditActivityController = require("../controllers/auditActivityController");
const pmFindingExplanationController = require("../controllers/pmFindingExplanationController");

/**
 * Every route here requires a valid JWT AND role = PM — same gate
 * pattern as routes/vendorRoutes.js.
 */
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.PM));

// This narrow, authenticated limiter prevents an optional external-provider
// request from being used as an unbounded proxy. It is deliberately local to
// the explanation action and does not affect ordinary PM workflows.
const explanationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `pm-explanation:${req.user.userId}`,
  message: { message: "Too many explanation requests. Please try again shortly." },
});

router.post("/projects", pmProjectController.create);
router.get("/projects", pmProjectController.list);
router.patch("/projects/:id", pmProjectController.update);
router.patch("/projects/:projectId/requirements/:requirementId", pmProjectController.updateRequirement);
// Module 5 addition: contractors assigned to one of this PM's own
// projects, powering the milestone-creation contractor picker.
router.get("/projects/:id/contractors", pmProjectController.listContractors);
// Project hours/allocation redesign addition: PM marks a project
// COMPLETED, auto-releasing every active assignment on it.
router.patch("/projects/:id/complete", pmProjectController.complete);
router.get("/projects/:id/close-readiness", pmProjectController.closeReadiness);
router.get("/projects/:id/control-intelligence", pmProjectControlController.analyze);
router.post("/projects/:projectId/control-intelligence/:findingCode/explanation", explanationLimiter, pmFindingExplanationController.explain);
router.get("/projects/:projectId/activity", auditActivityController.pmProject);
// MVP fix 1: the PM (never the Vendor) sets/changes a specific,
// already-assigned contractor's work-hour allocation on this project.
router.patch(
  "/projects/:projectId/contractors/:contractorId/allocation",
  pmProjectController.allocateHours
);
router.patch("/projects/:projectId/contractors/:contractorId/release", pmProjectController.release);

// Module 4: reviewing timesheets submitted against this PM's own
// projects. Same gate reuse rationale as /projects above — no new
// authenticate/authorizeRoles declaration needed.
router.get("/timesheets/pending", pmTimesheetController.listPending);
router.patch("/timesheets/bulk-review", pmTimesheetController.bulkReview);
router.patch("/timesheets/:id", pmTimesheetController.review);

// Module 5: milestone & billing engine. Same gate reuse rationale as
// /projects above — no new authenticate/authorizeRoles declaration
// needed.
router.post("/milestones", pmMilestoneController.create);
router.patch("/milestones/:id", pmMilestoneController.update);
router.get("/milestones/:projectId", pmMilestoneController.listForProject);

// Module 6, narrowed by the invoice-workflow redesign: read-only invoice
// HISTORY for this PM's own projects — approval moved to the Vendor (see
// routes/vendorRoutes.js's PATCH /invoices/:id). There is no PM-side
// mutation route anymore. Same gate reuse rationale as /projects above —
// no new authenticate/authorizeRoles declaration needed.
router.get("/invoices", pmInvoiceController.list);
router.patch("/invoices/:id/review", invoiceLifecycleController.review);
router.get("/invoices/:id/detail", invoiceLifecycleController.detail);
router.get("/invoices/:id/pdf", invoiceLifecycleController.pdf);

// UI + analytics redesign: a single read-only aggregated dashboard
// payload for the PM home screen — see pmDashboardService.js. Same gate
// reuse rationale as /projects above; no existing route above this line
// was changed.
router.get("/dashboard", pmDashboardController.getDashboard);
router.get('/dashboard/exports/:dataset', dashboardExportController.export);
router.get("/notifications", notificationController.list);
router.patch("/notifications/read-all", notificationController.readAll);
router.patch("/notifications/:id/read", notificationController.read);
router.get("/notification-preferences", notificationController.preferences);
router.put("/notification-preferences/:eventType", notificationController.preference);
router.get("/candidate-submissions", candidateSubmissionController.listPm);
router.get("/staffing-pipeline", staffingPipelineController.pm);
router.patch("/candidate-submissions/:id", candidateSubmissionController.decide);
router.get("/contractors/:contractorId/compliance", pmContractorDocumentController.summary);
router.post("/vendor-access", pmVendorAccessController.connect);
router.get("/vendors", pmVendorAccessController.listVendors);
router.get("/vendor-access", pmVendorAccessController.listConnections);
router.delete("/vendor-access/:vendorId", pmVendorAccessController.revoke);
router.post("/projects/:projectId/vendors", pmVendorAccessController.grant);
router.delete("/projects/:projectId/vendors/:vendorId", pmVendorAccessController.revokeProject);
router.post("/company/pm-invitations", authController.invitePm);

module.exports = router;
