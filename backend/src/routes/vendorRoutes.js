const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const vendorContractorController = require("../controllers/vendorContractorController");
const vendorAssignmentController = require("../controllers/vendorAssignmentController");
const vendorProjectController = require("../controllers/vendorProjectController");
const vendorInvoiceController = require("../controllers/vendorInvoiceController");
const vendorDashboardController = require("../controllers/vendorDashboardController");
const contractorDocumentController = require("../controllers/contractorDocumentController");
const vendorClientController = require("../controllers/vendorClientController");
const vendorAvailabilityController = require("../controllers/vendorAvailabilityController");
const candidateSubmissionController = require("../controllers/candidateSubmissionController");
const staffingPipelineController = require("../controllers/staffingPipelineController");
const notificationController = require("../controllers/notificationController");
const rateCardController = require("../controllers/rateCardController");
const invoiceLifecycleController = require("../controllers/invoiceLifecycleController");
const paymentController = require("../controllers/paymentController");
const dashboardExportController = require('../controllers/dashboardExportController');
const vendorOffboardingController = require('../controllers/vendorOffboardingController');

/**
 * Every route in this router requires a valid JWT AND role = VENDOR.
 * `authenticate` populates req.user = { userId, role } from the token;
 * `authorizeRoles` rejects anything that isn't VENDOR before a controller
 * ever runs. Contractor/PM tokens get a 403 here, never a partial response.
 */
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.VENDOR));

router.post("/contractors", vendorContractorController.create);
router.post("/contractors/:contractorId/availability", vendorAvailabilityController.create);
router.get("/candidate-submissions", candidateSubmissionController.listVendor);
router.get("/staffing-pipeline", staffingPipelineController.vendor);
router.get("/contractors", vendorContractorController.list);
router.patch("/contractors/:id", vendorContractorController.update);
router.get("/contractors/:id/history", vendorContractorController.history);
router.get('/projects/:projectId/contractors/:contractorId/release-readiness', vendorOffboardingController.readiness);
router.patch('/projects/:projectId/contractors/:contractorId/release', vendorOffboardingController.release);
router.post("/contractors/:id/resend-invitation", vendorContractorController.resendInvitation);
router.get("/clients", vendorClientController.list);
router.get("/clients/:companyId", vendorClientController.detail);
router.get("/clients/:companyId/rate-cards", rateCardController.list);
router.get("/rate-card-skills", rateCardController.listSkills);
router.post("/rate-cards", rateCardController.create);
router.patch("/rate-cards/:id", rateCardController.update);
router.post("/contractor-documents", contractorDocumentController.upload);
router.get("/contractors/:contractorId/documents", contractorDocumentController.list);
router.patch("/contractor-documents/:id/review", contractorDocumentController.review);

// Module 3 revision: browsing projects open for staffing. Vendor-centric
// workflow revision replaced the old "type in a project ID" flow (and the
// old single-contractor POST /assignments endpoint below it) with these
// nested-resource routes: browse -> one project's requirements -> one
// requirement's eligible contractors -> atomic multi-contractor assign.
// Same gate reuse rationale as /contractors above — no new
// authenticate/authorizeRoles declaration needed.
router.get("/projects", vendorProjectController.list);
router.get("/projects/:id/requirements", vendorProjectController.getRequirements);
router.get(
  "/projects/:id/requirements/:requirementId/eligible-contractors",
  vendorProjectController.getEligibleContractors
);
router.post("/projects/:projectId/requirements/:requirementId/candidates", candidateSubmissionController.submit);
router.patch("/candidate-submissions/:id/withdraw", candidateSubmissionController.withdraw);

// Module 6, extended by the invoice-workflow redesign: invoice visibility
// AND approve/reject authority for a vendor's own contractors (approval
// moved here from the PM side — see vendorInvoiceService.reviewInvoice).
// Same gate reuse rationale as /contractors above — no new
// authenticate/authorizeRoles declaration needed.
router.get("/invoices", vendorInvoiceController.list);
router.patch("/invoices/:id", invoiceLifecycleController.update);
router.get("/billing-queue", invoiceLifecycleController.queue);
router.post("/invoices/drafts", invoiceLifecycleController.draft);
router.post("/invoices/:id/items", invoiceLifecycleController.add);
router.delete("/invoices/:id/items", invoiceLifecycleController.remove);
router.post("/invoices/:id/submit", invoiceLifecycleController.submit);
router.post("/invoices/:id/pdf", invoiceLifecycleController.regenerate);
router.post("/invoices/:id/revise", invoiceLifecycleController.revise);
router.post("/invoices/:id/cancel", invoiceLifecycleController.cancel);
router.get("/invoices/:id/detail", invoiceLifecycleController.detail);
router.get("/invoices/:id/pdf", invoiceLifecycleController.pdf);
router.post("/invoices/:id/payments", paymentController.record);

// UI + analytics redesign: a single read-only aggregated dashboard
// payload for the Vendor home screen (KPIs, earnings, project progress,
// invoice overview, recent activity) — see vendorDashboardService.js.
// Same gate reuse rationale as /contractors above — no new
// authenticate/authorizeRoles declaration needed, and no existing route
// above this line was changed.
router.get("/dashboard", vendorDashboardController.getDashboard);
router.get('/dashboard/exports/:dataset', dashboardExportController.export);
router.get("/notifications", notificationController.list);
router.patch("/notifications/read-all", notificationController.readAll);
router.patch("/notifications/:id/read", notificationController.read);
router.get("/notification-preferences", notificationController.preferences);
router.put("/notification-preferences/:eventType", notificationController.preference);

module.exports = router;
