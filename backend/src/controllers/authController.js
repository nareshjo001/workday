const authService = require("../services/authService");
const { validateSignup, validateLogin } = require("../validators/authValidators");
const asyncHandler = require("../utils/asyncHandler");

const signup = asyncHandler(async (req, res) => {
  const payload = validateSignup(req.body);
  const user = await authService.signup(payload);
  res.status(201).json({ message: "User registered successfully", user });
});

const login = asyncHandler(async (req, res) => {
  const payload = validateLogin(req.body);
  const { token, user } = await authService.login(payload);
  res.status(200).json({ message: "Login successful", token, user });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.userId);
  res.status(200).json({ user });
});

module.exports = { signup, login, me };
