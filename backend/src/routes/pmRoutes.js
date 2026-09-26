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

// Require an authenticated PM for every route in this router.
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.PM));

// Rate-limit external explanation requests without throttling ordinary PM workflows.
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
router.get("/projects/:id/contractors", pmProjectController.listContractors);
// Complete the project and release its active assignments atomically.
router.patch("/projects/:id/complete", pmProjectController.complete);
router.get("/projects/:id/close-readiness", pmProjectController.closeReadiness);
router.get("/projects/:id/control-intelligence", pmProjectControlController.analyze);
router.post("/projects/:projectId/control-intelligence/:findingCode/explanation", explanationLimiter, pmFindingExplanationController.explain);
router.get("/projects/:projectId/activity", auditActivityController.pmProject);
router.get("/activity", auditActivityController.pm);
// Only the PM may change an assigned contractor's work-hour allocation.
router.patch(
  "/projects/:projectId/contractors/:contractorId/allocation",
  pmProjectController.allocateHours
);
router.patch("/projects/:projectId/contractors/:contractorId/release", pmProjectController.release);

router.get("/timesheets/pending", pmTimesheetController.listPending);
router.patch("/timesheets/bulk-review", pmTimesheetController.bulkReview);
router.patch("/timesheets/:id", pmTimesheetController.review);

router.post("/milestones", pmMilestoneController.create);
router.patch("/milestones/:id", pmMilestoneController.update);
router.get("/milestones/:projectId", pmMilestoneController.listForProject);

// List invoices within the authenticated PM's visibility scope.
router.get("/invoices", pmInvoiceController.list);
router.patch("/invoices/:id/review", invoiceLifecycleController.review);
router.get("/invoices/:id/detail", invoiceLifecycleController.detail);
router.get("/invoices/:id/pdf", invoiceLifecycleController.pdf);

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
