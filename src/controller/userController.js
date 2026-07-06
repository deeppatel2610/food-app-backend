const { sendSuccess, sendError } = require("../utils/responseHandler");
const { findUserById, findUserByEmailOrUsername, updateUser } = require("../models/userModel");
const { enrichUserWithBMI, calculateBMI } = require("../utils/bmiHelper");
const { validateUserFields } = require("../utils/validationHelper");

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

/**
 * Edit Authenticated User Profile details (PUT api)
 * Updates the fields provided in request body, checks uniqueness, recalculates BMI, and persists updates.
 */
const editUserProfile = async (req, res, next) => {
  try {
    // 1. Retrieve the authenticated user's ID from the JWT request payload
    const id = req.user.userId;
    const {
      first_name,
      last_name,
      username,
      email,
      age,
      weight,
      height,
      blood_group,
      health_problem,
    } = req.body;

    // 2. Perform validation on input field types, format constraints, and value ranges
    const validationResult = validateUserFields(req.body, true);
    if (!validationResult.isValid) {
      return sendError(res, validationResult.error, null, 400);
    }

    // 3. Check if user actually exists in the database
    const user = await findUserById(id);
    if (!user) {
      return sendError(res, "User not found.", null, 404);
    }

    // 4. Verify email uniqueness - Ensure new email is not taken by another active user
    if (email && email !== user.email) {
      const existingUser = await findUserByEmailOrUsername(email, "");
      if (existingUser && existingUser.id !== id) {
        return sendError(res, "Email is already registered.", null, 400);
      }
    }

    // 5. Verify username uniqueness - Ensure new username is not taken by another active user
    if (username && username !== user.username) {
      const existingUser = await findUserByEmailOrUsername("", username);
      if (existingUser && existingUser.id !== id) {
        return sendError(res, "Username is already taken.", null, 400);
      }
    }

    // 6. Build the dynamic update query payload (only update fields that are provided)
    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name === "" ? null : first_name;
    if (last_name !== undefined) updateData.last_name = last_name === "" ? null : last_name;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (age !== undefined) updateData.age = (age === "" || age === null) ? null : parseInt(age, 10);
    if (weight !== undefined) updateData.weight = (weight === "" || weight === null) ? null : parseFloat(weight);
    if (height !== undefined) updateData.height = (height === "" || height === null) ? null : parseFloat(height);
    if (blood_group !== undefined) updateData.blood_group = blood_group === "" ? null : blood_group;
    if (health_problem !== undefined) updateData.health_problem = health_problem === "" ? null : health_problem;

    // 7. Recalculate BMI and category if weight or height has been updated
    if (weight !== undefined || height !== undefined) {
      const finalWeight = weight !== undefined ? updateData.weight : user.weight;
      const finalHeight = height !== undefined ? updateData.height : user.height;
      updateData.bmi = calculateBMI(finalWeight, finalHeight);
    }

    // 8. If request payload contains no valid fields to update, reject request
    if (Object.keys(updateData).length === 0) {
      return sendError(res, "At least one field must be provided to update.", null, 400);
    }

    // 9. Execute update in the database and retrieve updated user record
    const updatedUser = await updateUser(id, updateData);
    if (!updatedUser) {
      return sendError(res, "Failed to update user profile.", null, 500);
    }

    // 10. Enrich profile data with new BMI category, BMI report, and daily calorie budget
    enrichUserWithBMI(updatedUser);

    // 11. Remove sensitive metadata fields from output for security
    delete updatedUser.password;
    delete updatedUser.refresh_token;
    delete updatedUser.created_at;
    delete updatedUser.updated_at;

    // 12. Send successful update response back to client
    return sendSuccess(res, "User profile updated successfully.", updatedUser, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  editUserProfile,
};
