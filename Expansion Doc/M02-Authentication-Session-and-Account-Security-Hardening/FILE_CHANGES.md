# File changes

## Added files

- `backend/src/migrations/017_auth_sessions_tokens_and_invitations.sql` — session, action-token, and lockout schema.
- `backend/src/repositories/authSessionRepository.js` — session persistence and revocation queries.
- `backend/src/repositories/authActionTokenRepository.js` — purpose-scoped single-use token queries.
- `backend/src/services/mailService.js` — SMTP and deterministic outbox delivery abstraction.
- `backend/src/utils/secureToken.js` — random-token generation and hashing.
- `backend/test/integration/auth-security.test.js` — M02 integration coverage.
- `frontend/src/pages/ForgotPasswordPage.jsx` — account recovery UI.
- `frontend/src/pages/PasswordActionPage.jsx` — reset/setup-password UI.
- `frontend/src/pages/PasswordActionPage.test.jsx` — password-link UI tests.
- `Expansion Doc/M02-Authentication-Session-and-Account-Security-Hardening/{README,IMPLEMENTATION,TESTING,AUDIT,FILE_CHANGES}.md` — module handoff documentation.

## Modified files

- `backend/.env.example`, `backend/package.json`, `backend/package-lock.json` — M02 configuration and dependencies.
- `backend/src/app.js`, `backend/src/config/env.js`, `backend/src/controllers/authController.js`, `backend/src/controllers/vendorContractorController.js`, `backend/src/middleware/authenticate.js`, `backend/src/routes/authRoutes.js`, and `backend/src/routes/vendorRoutes.js` — security boundary and endpoints.
- `backend/src/repositories/contractorRepository.js`, `backend/src/repositories/userRepository.js`, `backend/src/services/authService.js`, `backend/src/services/vendorContractorService.js`, `backend/src/utils/jwt.js`, `backend/src/validators/authValidators.js`, and `backend/src/validators/vendorContractorValidators.js` — business rules and persistence integration.
- `frontend/src/App.jsx`, `frontend/src/context/AuthContext.jsx`, `frontend/src/layouts/DashboardLayout.jsx`, `frontend/src/pages/LoginPage.jsx`, `frontend/src/components/contractors/AddContractorModal.jsx`, `frontend/src/services/apiClient.js`, `frontend/src/services/authService.js`, `frontend/src/services/vendorContractorService.js`, and `frontend/src/utils/tokenStorage.js` — session and account-recovery experience.
- `Expansion/Workday_VMS_Expansion_Feature_Tracker.xlsx` — M02 completion state and notes.

## Deleted files

Deleted files: None.
