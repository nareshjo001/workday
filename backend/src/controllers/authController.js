const authService = require("../services/authService");
const { validateSignup, validateLogin, validateActionToken, validateNewPassword, validateRecoveryRequest } = require("../validators/authValidators");
const asyncHandler = require("../utils/asyncHandler");

const signup = asyncHandler(async (req, res) => {
  const payload = validateSignup(req.body);
  const user = await authService.signup({ ...payload, auditActor: { requestId: req.requestId } });
  res.status(201).json({ message: "User registered successfully", user });
});

const login = asyncHandler(async (req, res) => {
  const payload = validateLogin(req.body);
  const { token, refreshToken, user } = await authService.login(payload);
  res.cookie("vms_refresh", refreshToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth" });
  res.status(200).json({ message: "Login successful", token, user });
});
const refresh = asyncHandler(async (req,res)=>{ const result=await authService.refresh(req.cookies?.vms_refresh); res.cookie("vms_refresh",result.refreshToken,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/api/auth"}); res.json({token:result.token,user:result.user}); });
const logoutAll = asyncHandler(async (req,res)=>{ await authService.logoutAll(req.user.userId); res.clearCookie("vms_refresh",{path:"/api/auth"}); res.status(204).end(); });
const forgotPassword = asyncHandler(async (req,res)=>{ const email=validateRecoveryRequest(req.body); if(email) { try { await authService.issueAction(email,"PASSWORD_RESET"); } catch { /* preserve non-enumerating recovery response; resend remains available */ } } res.status(202).json({message:"If that account exists, a recovery link has been sent."}); });
const logout = asyncHandler(async (req,res)=>{ await authService.logout(req.cookies?.vms_refresh); res.clearCookie("vms_refresh",{path:"/api/auth",httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"}); res.status(204).end(); });
const resetPassword = asyncHandler(async (req,res)=>{ await authService.consumeAction(validateActionToken(req.body),"PASSWORD_RESET",validateNewPassword(req.body)); res.status(204).end(); });
const setupPassword = asyncHandler(async (req,res)=>{ await authService.consumeAction(validateActionToken(req.body),"CONTRACTOR_INVITATION",validateNewPassword(req.body)); res.status(204).end(); });

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.userId);
  res.status(200).json({ user });
});
const invitePm = asyncHandler(async (req,res)=>{ const email=validateRecoveryRequest(req.body); if(!email) throw require('../utils/ApiError').badRequest('A valid email is required.'); const token=await authService.invitePmToCompany(req.user.userId,email,{requestId:req.requestId}); res.status(201).json({message:'PM invitation created.', ...(token ? { token } : {})}); });

module.exports = { signup, login, refresh, logout, logoutAll, forgotPassword, resetPassword, setupPassword, me, invitePm };
