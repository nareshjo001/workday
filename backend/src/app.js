const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const pmRoutes = require("./routes/pmRoutes");
const contractorRoutes = require("./routes/contractorRoutes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const requestContext = require("./middleware/requestContext");
const { testConnection } = require("./config/db");
const mailService = require("./services/mailService");

const app = express();

app.use(helmet());
app.use(requestContext);

app.use(
  cors({
    origin(origin, callback) {
      // Browser requests must originate from an explicitly configured SPA.
      // Requests without Origin (health checks/server-to-server) are allowed.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "8mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again later." },
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "live" });
});
app.get("/api/health/live", (req, res) => res.status(200).json({ status: "live" }));
app.get("/api/health/ready", async (req, res, next) => {
  try {
    await testConnection();
    res.status(200).json({ status: "ready", dependencies: { database: "ready", mail: mailService.status() } });
  } catch (err) { next(err); }
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/pm", pmRoutes);
app.use("/api/contractor", contractorRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
