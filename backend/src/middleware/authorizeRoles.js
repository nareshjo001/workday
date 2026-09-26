const ApiError = require("../utils/ApiError");

// Check allowed roles after authentication has populated req.user.
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
