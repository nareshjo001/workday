const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Minimal role-gated endpoints that exist solely to verify the
 * authentication/authorization foundation end-to-end. They intentionally
 * contain no business logic. Later modules will replace/remove these once
 * real vendor/contractor/PM endpoints exist.
 */
const router = express.Router();

router.get(
  "/vendor-only",
  authenticate,
  authorizeRoles(ROLES.VENDOR),
  asyncHandler(async (req, res) => {
    res.status(200).json({ message: "Vendor access confirmed.", role: req.user.role });
  })
);

router.get(
  "/contractor-only",
  authenticate,
  authorizeRoles(ROLES.CONTRACTOR),
  asyncHandler(async (req, res) => {
    res.status(200).json({ message: "Contractor access confirmed.", role: req.user.role });
  })
);

router.get(
  "/pm-only",
  authenticate,
  authorizeRoles(ROLES.PM),
  asyncHandler(async (req, res) => {
    res.status(200).json({ message: "PM access confirmed.", role: req.user.role });
  })
);

module.exports = router;
