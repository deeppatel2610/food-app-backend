const { sendSuccess, sendError } = require("../utils/responseHandler");
const { findUserById } = require("../models/userModel");
const { enrichUserWithBMI } = require("../utils/bmiHelper");

/**
 * Get Authenticated User Profile details (Returns main details, BMI, and BMI report)
 */
const getUserProfile = async (req, res, next) => {
  try {
    const id = req.user.userId;

    const user = await findUserById(id);
    if (!user) {
      return sendError(res, "User not found.", null, 404);
    }

    // Populate BMI, Category and Report
    enrichUserWithBMI(user);

    // Remove sensitive fields before sending response
    delete user.password;
    delete user.refresh_token;
    delete user.created_at;
    delete user.updated_at;

    return sendSuccess(res, "User details retrieved successfully.", user, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
};
