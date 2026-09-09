const vendorDashboardService = require("../services/vendorDashboardService");
const analytics = require('../services/dashboardAnalyticsService');
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/vendor/dashboard — UI + analytics redesign. `req.user.userId`
 * (set by `authenticate` from the verified JWT) is the ONLY source of
 * the acting vendor's identity here, same convention as every other
 * controller in this codebase — there is no vendor id anywhere in this
 * route's path/query/body.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const filters = analytics.filters(req.query);
  const m20 = await analytics.dashboard('VENDOR', req.user.userId, filters);
  const dashboard = await vendorDashboardService.getVendorDashboard(req.user.userId, filters, m20);
  dashboard.m20 = m20;
  res.status(200).json(dashboard);
});

module.exports = { getDashboard };
