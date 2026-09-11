const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ALL_ROLES } = require("../constants/roles");
const intelligenceController = require("../controllers/intelligenceController");

const router = express.Router();
router.get("/capabilities", authenticate, authorizeRoles(...ALL_ROLES), intelligenceController.capabilities);

module.exports = router;
