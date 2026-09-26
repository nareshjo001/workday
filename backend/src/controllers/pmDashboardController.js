const pmDashboardService = require("../services/pmDashboardService");
const analytics = require('../services/dashboardAnalyticsService');
const asyncHandler = require("../utils/asyncHandler");

// Scope dashboard data to the authenticated PM.
const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await pmDashboardService.getPmDashboard(req.user.userId);
  dashboard.m20 = await analytics.dashboard('PM', req.user.userId, req.query);
  res.status(200).json(dashboard);
});

module.exports = { getDashboard };
