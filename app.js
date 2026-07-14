const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/config/swaggerConfig");
const routes = require("./src/routes/routes");
const { apiRateLimiter } = require("./src/middleware/rateLimiter");
const { notFoundHandler, globalErrorHandler } = require("./src/middleware/errorHandler");
const { requestLogger } = require("./src/middleware/loggerMiddleware");
const envVariables = require("./src/utils/envVariables");

const app = express();

// Trust proxy for correct client IP detection in rate limiters
app.set("trust proxy", 1);

// Security headers with CSP customized to allow Swagger UI
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "validator.swagger.io"],
      },
    },
  })
);

// CORS configuration
const allowedOrigins = envVariables.ALLOWED_ORIGINS.split(",").map(o => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes("*");
      if (isAllowed) {
        callback(null, true);
      } else {
        // Return false to block CORS without causing uncaught server error crashes
        callback(null, false);
      }
    },
    credentials: true,
  })
);

// Terminal API Logger Middleware
app.use(requestLogger);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Swagger UI Documentation Endpoint (Caching disabled to ensure fresh load and bypass cached blank pages)
app.use(
  "/api-docs",
  (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

// Global Rate Limiter for all APIs
app.use("/api", apiRateLimiter);

// Main API Routes
app.use("/api", routes);

// 404 Route Not Found Handler
app.use(notFoundHandler);

// Global Error Handler Middleware
app.use(globalErrorHandler);

module.exports = app;
