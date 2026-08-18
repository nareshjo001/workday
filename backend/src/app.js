const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const sampleProtectedRoutes = require("./routes/sampleProtectedRoutes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
// Verification-only endpoints for the RBAC middleware (see Module 1 testing notes).
app.use("/api/_sample", sampleProtectedRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
