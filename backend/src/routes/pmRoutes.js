const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const pmProjectController = require("../controllers/pmProjectController");

/**
 * Every route here requires a valid JWT AND role = PM — same gate
 * pattern as routes/vendorRoutes.js.
 */
const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.PM));

router.post("/projects", pmProjectController.create);
router.get("/projects", pmProjectController.list);

module.exports = router;
