const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/config/swaggerConfig");
const routes = require("./src/routes/routes");
const { apiRateLimiter } = require("./src/middleware/rateLimiter");
const { notFoundHandler, globalErrorHandler } = require("./src/middleware/errorHandler");
const { requestLogger } = require("./src/middleware/loggerMiddleware");

const app = express();

// Terminal API Logger Middleware
app.use(requestLogger);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI Documentation Endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Global Rate Limiter for all APIs
app.use("/api", apiRateLimiter);

// Main API Routes
app.use("/api", routes);

// 404 Route Not Found Handler
app.use(notFoundHandler);

// Global Error Handler Middleware
app.use(globalErrorHandler);

module.exports = app;
