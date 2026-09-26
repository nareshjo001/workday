const contractorProfileService = require("../services/contractorProfileService");
const { validateUpdateProfile } = require("../validators/contractorProfileValidators");
const asyncHandler = require("../utils/asyncHandler");

// Scope profile access to the authenticated contractor.
const getProfile = asyncHandler(async (req, res) => {
  const profile = await contractorProfileService.getProfile(req.user.userId);
  res.status(200).json(profile);
});

const updateProfile = asyncHandler(async (req, res) => {
  const payload = validateUpdateProfile(req.body);
  const result = await contractorProfileService.updateProfile(req.user.userId, payload, { ...req.user, requestId: req.requestId });
  res.status(200).json(result);
});

module.exports = { getProfile, updateProfile };
