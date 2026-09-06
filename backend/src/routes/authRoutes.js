const express = require("express");
const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");
const cookieParser = require("cookie-parser");

const router = express.Router();

router.use(cookieParser());
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/setup-password", authController.setupPassword);
router.get("/me", authenticate, authController.me);
router.post("/logout-all", authenticate, authController.logoutAll);

module.exports = router;
