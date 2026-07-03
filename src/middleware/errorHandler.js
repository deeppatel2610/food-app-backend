const { sendError } = require("../utils/responseHandler");

/**
 * 404 Route Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  return sendError(res, `Route Not Found - ${req.originalUrl}`, null, 404);
};

/**
 * Global Error Handling Middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  console.error("Uncaught Server Error:", err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";
  const errorDetails = process.env.NODE_ENV === "development" ? err.stack : null;

  return sendError(res, message, errorDetails, statusCode);
};

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
