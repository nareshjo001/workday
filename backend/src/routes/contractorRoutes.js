const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const contractorProjectController = require("../controllers/contractorProjectController");
const contractorProfileController = require("../controllers/contractorProfileController");
const contractorTimesheetController = require("../controllers/contractorTimesheetController");
const contractorDashboardController = require("../controllers/contractorDashboardController");
const contractorAvailabilityController = require("../controllers/contractorAvailabilityController");
const notificationController = require("../controllers/notificationController");
const contractorTimesheetIntelligenceController = require("../controllers/contractorTimesheetIntelligenceController");
const auditActivityController = require("../controllers/auditActivityController");

// Require an authenticated contractor for every route in this router.
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.CONTRACTOR));

router.get("/projects", contractorProjectController.list);
router.get("/activity", auditActivityController.contractor);

router.get("/profile", contractorProfileController.getProfile);
router.patch("/profile", contractorProfileController.updateProfile);
// Compatibility route retained while existing clients migrate to PATCH /profile.
router.patch("/profile/skill", contractorProfileController.updateProfile);
router.get("/availability", contractorAvailabilityController.list);
router.post("/availability", contractorAvailabilityController.create);
router.delete("/availability/:id", contractorAvailabilityController.cancel);

router.post("/timesheets", contractorTimesheetController.submit);
router.post("/timesheet-intelligence/analyze", contractorTimesheetIntelligenceController.analyze);
router.post("/timesheets/submit", contractorTimesheetController.submitSelected);
router.get("/timesheets", contractorTimesheetController.list);
router.patch("/timesheets/:id", contractorTimesheetController.update);

router.get("/dashboard", contractorDashboardController.getDashboard);
router.get("/notifications", notificationController.list);
router.patch("/notifications/read-all", notificationController.readAll);
router.patch("/notifications/:id/read", notificationController.read);
router.get("/notification-preferences", notificationController.preferences);
router.put("/notification-preferences/:eventType", notificationController.preference);

module.exports = router;
