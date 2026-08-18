const ApiError = require("../utils/ApiError");

/**
 * Role-based authorization middleware factory.
 * Must run after `authenticate`, which populates req.user.
 *
 * Usage:
 *   router.post("/vendor-only", authenticate, authorizeRoles("VENDOR"), handler);
 *   router.post("/shared", authenticate, authorizeRoles("VENDOR", "PM"), handler);
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required."));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have access to this resource."));
    }
    return next();
  };
}

module.exports = authorizeRoles;
