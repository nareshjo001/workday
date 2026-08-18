const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const { ROLES } = require("../constants/roles");
const vendorContractorController = require("../controllers/vendorContractorController");

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

module.exports = router;
