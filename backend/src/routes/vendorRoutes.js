const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const vendorContractorController = require("../controllers/vendorContractorController");
const vendorAssignmentController = require("../controllers/vendorAssignmentController");
const vendorProjectController = require("../controllers/vendorProjectController");
const vendorInvoiceController = require("../controllers/vendorInvoiceController");
const vendorDashboardController = require("../controllers/vendorDashboardController");

/**
 * Every route in this router requires a valid JWT AND role = VENDOR.
 * `authenticate` populates req.user = { userId, role } from the token;
 * `authorizeRoles` rejects anything that isn't VENDOR before a controller
 * ever runs. Contractor/PM tokens get a 403 here, never a partial response.
 */
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.VENDOR));

router.post("/contractors", vendorContractorController.create);
router.get("/contractors", vendorContractorController.list);
router.patch("/contractors/:id", vendorContractorController.update);

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
router.post(
  "/projects/:id/requirements/:requirementId/assign",
  vendorAssignmentController.assign
);

// Module 6, extended by the invoice-workflow redesign: invoice visibility
// AND approve/reject authority for a vendor's own contractors (approval
// moved here from the PM side — see vendorInvoiceService.reviewInvoice).
// Same gate reuse rationale as /contractors above — no new
// authenticate/authorizeRoles declaration needed.
router.get("/invoices", vendorInvoiceController.list);
router.patch("/invoices/:id", vendorInvoiceController.review);

// UI + analytics redesign: a single read-only aggregated dashboard
// payload for the Vendor home screen (KPIs, earnings, project progress,
// invoice overview, recent activity) — see vendorDashboardService.js.
// Same gate reuse rationale as /contractors above — no new
// authenticate/authorizeRoles declaration needed, and no existing route
// above this line was changed.
router.get("/dashboard", vendorDashboardController.getDashboard);

module.exports = router;
