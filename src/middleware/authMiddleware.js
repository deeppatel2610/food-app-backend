const jwt = require("jsonwebtoken");
const envVariables = require("../utils/envVariables");
const { sendError } = require("../utils/responseHandler");

/**
 * JWT Authentication Middleware
 * Verifies Bearer token in request Authorization header.
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, "Access denied. No token provided.", null, 401);
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = envVariables.JWT || "default_jwt_secret_key";

    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // Attach user payload (userId, username, email) to request
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, "Token has expired. Please log in again.", null, 401);
    }
    return sendError(res, "Invalid authentication token.", null, 403);
  }
};

module.exports = {
  verifyToken,
};
