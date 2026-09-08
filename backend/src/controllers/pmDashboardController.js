const pmDashboardService = require("../services/pmDashboardService");
const analytics = require('../services/dashboardAnalyticsService');
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/pm/dashboard — UI + analytics redesign. `req.user.userId` is
 * the ONLY source of the acting PM's identity — same convention as every
 * other PM controller in this codebase.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await pmDashboardService.getPmDashboard(req.user.userId);
  dashboard.m20 = await analytics.dashboard('PM', req.user.userId, req.query);
  res.status(200).json(dashboard);
});

module.exports = { getDashboard };
