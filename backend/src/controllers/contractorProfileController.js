const contractorProfileService = require("../services/contractorProfileService");
const { validateUpdateProfile } = require("../validators/contractorProfileValidators");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` is the ONLY source of identity here — a contractor
 * can view/update only their own profile, never one passed in via a
 * param or the body.
 */
const getProfile = asyncHandler(async (req, res) => {
  const profile = await contractorProfileService.getProfile(req.user.userId);
  res.status(200).json(profile);
});

const updateProfile = asyncHandler(async (req, res) => {
  const { skill } = validateUpdateProfile(req.body);
  const result = await contractorProfileService.updateSkill(req.user.userId, skill);
  res.status(200).json(result);
});

module.exports = { getProfile, updateProfile };
