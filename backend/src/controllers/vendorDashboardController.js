const vendorDashboardService = require("../services/vendorDashboardService");
const analytics = require('../services/dashboardAnalyticsService');
const asyncHandler = require("../utils/asyncHandler");

// Scope dashboard data to the authenticated vendor.
const getDashboard = asyncHandler(async (req, res) => {
  const filters = analytics.filters(req.query);
  const m20 = await analytics.dashboard('VENDOR', req.user.userId, filters);
  const dashboard = await vendorDashboardService.getVendorDashboard(req.user.userId, filters, m20);
  dashboard.m20 = m20;
  res.status(200).json(dashboard);
});

module.exports = { getDashboard };
