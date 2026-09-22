const crypto = require("crypto");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const {
  findUserById,
  findUserByEmailOrUsername,
  updateUser,
  saveUserAIBmiReport,
} = require("../models/userModel");
const {
  saveUserUpdateOtp,
  findUserUpdateOtp,
  deleteUserUpdateOtp,
} = require("../models/otpModel");
const { enrichUserWithBMI, calculateBMI, getBMICategory } = require("../utils/bmiHelper");
const { generateAIBmiReport } = require("../utils/geminiService");
const { validateUserFields } = require("../utils/validationHelper");
const {
  sendProfileUpdateOtpEmail,
  sendOldEmailChangeOtpEmail,
  sendNewEmailVerificationOtpEmail,
} = require("../utils/emailHelper");

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
 * Helper: Validates update payload and prepares clean updateData object
 */
const prepareUpdateData = async (userId, body, currentUser) => {
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
  } = body;

  const validationResult = validateUserFields(body, true);
  if (!validationResult.isValid) {
    return { error: validationResult.error, statusCode: 400 };
  }

  if (email && email.trim().toLowerCase() !== currentUser.email?.toLowerCase()) {
    const existingUser = await findUserByEmailOrUsername(email.trim().toLowerCase(), "");
    if (existingUser && existingUser.id !== userId) {
      return { error: "Email is already registered by another account.", statusCode: 400 };
    }
  }

  if (username && username.trim().toLowerCase() !== currentUser.username?.toLowerCase()) {
    const existingUser = await findUserByEmailOrUsername("", username.trim());
    if (existingUser && existingUser.id !== userId) {
      return { error: "Username is already taken.", statusCode: 400 };
    }
  }

  const updateData = {};
  if (first_name !== undefined) updateData.first_name = first_name === "" ? null : first_name.trim();
  if (last_name !== undefined) updateData.last_name = last_name === "" ? null : last_name.trim();
  if (username !== undefined) updateData.username = username === "" ? null : username.trim();
  if (email !== undefined) updateData.email = email === "" ? null : email.trim().toLowerCase();
  if (age !== undefined) updateData.age = (age === "" || age === null) ? null : parseInt(age, 10);
  if (weight !== undefined) updateData.weight = (weight === "" || weight === null) ? null : parseFloat(weight);
  if (height !== undefined) updateData.height = (height === "" || height === null) ? null : parseFloat(height);
  if (blood_group !== undefined) updateData.blood_group = blood_group === "" ? null : blood_group.trim();
  if (health_problem !== undefined) updateData.health_problem = health_problem === "" ? null : health_problem.trim();

  if (weight !== undefined || height !== undefined) {
    const finalWeight = weight !== undefined ? updateData.weight : currentUser.weight;
    const finalHeight = height !== undefined ? updateData.height : currentUser.height;
    updateData.bmi = calculateBMI(finalWeight, finalHeight);
  }

  if (Object.keys(updateData).length === 0) {
    return { error: "At least one valid field must be provided to update.", statusCode: 400 };
  }

  return { updateData };
};

/**
 * Step 1: Request User Profile Update & Send OTP(s) via Email
 * - If email is being changed: Generates 2 separate OTPs and sends to BOTH old email and new email.
 * - If email is not changing: Generates 1 OTP and sends to current email.
 */
const requestUserProfileUpdate = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const user = await findUserById(userId);
    if (!user) {
      return sendError(res, "User not found.", null, 404);
    }

    const { error, statusCode, updateData } = await prepareUpdateData(userId, req.body, user);
    if (error) {
      return sendError(res, error, null, statusCode || 400);
    }

    const isEmailChange = !!(updateData.email && updateData.email.toLowerCase() !== user.email?.toLowerCase());
    const isDev = process.env.NODE_ENV === "development";

    if (isEmailChange) {
      const oldEmail = user.email.toLowerCase().trim();
      const newEmail = updateData.email.toLowerCase().trim();

      // Generate 2 separate 6-digit OTP codes for old and new email
      const oldEmailOtp = crypto.randomInt(100000, 1000000).toString();
      const newEmailOtp = crypto.randomInt(100000, 1000000).toString();

      // Save pending update with dual OTP details
      await saveUserUpdateOtp({
        userId,
        email: newEmail,
        updateData,
        isEmailChange: true,
        oldEmail,
        newEmail,
        oldEmailOtp,
        newEmailOtp,
        expiresInMinutes: 10,
      });

      // Dispatch authorization code to OLD email
      await sendOldEmailChangeOtpEmail(
        oldEmail,
        oldEmailOtp,
        newEmail,
        user.first_name || user.username || "User"
      );

      // Dispatch verification code to NEW email
      await sendNewEmailVerificationOtpEmail(
        newEmail,
        newEmailOtp,
        updateData.first_name || user.first_name || user.username || "User"
      );

      return sendSuccess(
        res,
        "Email update requires dual verification. OTP codes have been sent to both your current email and your new email.",
        {
          requiresOtp: true,
          isEmailChange: true,
          oldEmail,
          newEmail,
          expiresInMinutes: 10,
          pendingFields: Object.keys(updateData),
          ...(isDev ? { devOldEmailOtp: oldEmailOtp, devNewEmailOtp: newEmailOtp } : {}),
        },
        200
      );
    } else {
      // Standard single OTP profile update
      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const targetEmail = user.email.toLowerCase().trim();

      await saveUserUpdateOtp({
        userId,
        email: targetEmail,
        otpCode,
        updateData,
        isEmailChange: false,
        expiresInMinutes: 10,
      });

      await sendProfileUpdateOtpEmail(
        targetEmail,
        otpCode,
        updateData.first_name || user.first_name || user.username || "User"
      );

      return sendSuccess(
        res,
        "Verification code has been sent to your email. Please submit the OTP to confirm your profile update.",
        {
          requiresOtp: true,
          isEmailChange: false,
          email: targetEmail,
          expiresInMinutes: 10,
          pendingFields: Object.keys(updateData),
          ...(isDev ? { devOtp: otpCode } : {}),
        },
        200
      );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Step 2: Verify OTP(s) and apply pending profile updates to the database
 * - If email changed: Verifies BOTH `old_email_otp` and `new_email_otp`.
 * - If email not changed: Verifies single `otp`.
 */
const verifyUserProfileUpdateOtp = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Find pending update record
    const pendingRecord = await findUserUpdateOtp(userId);
    if (!pendingRecord) {
      return sendError(
        res,
        "No pending profile update request found. Please submit your update details first.",
        null,
        404
      );
    }

    // Check OTP expiration
    if (new Date() > new Date(pendingRecord.expires_at)) {
      return sendError(
        res,
        "The OTP code has expired. Please submit your profile update request again to get a new code.",
        null,
        400
      );
    }

    if (pendingRecord.is_email_change) {
      const oldEmailOtp = (
        req.body.old_email_otp ||
        req.body.oldEmailOtp ||
        req.body.oldOtp ||
        req.body.currentEmailOtp ||
        ""
      ).toString().trim();

      const newEmailOtp = (
        req.body.new_email_otp ||
        req.body.newEmailOtp ||
        req.body.newOtp ||
        ""
      ).toString().trim();

      if (!oldEmailOtp || !newEmailOtp) {
        return sendError(
          res,
          "Changing your email address requires verifying both codes: 'old_email_otp' (sent to current email) and 'new_email_otp' (sent to new email).",
          null,
          400
        );
      }

      if (pendingRecord.old_email_otp !== oldEmailOtp) {
        return sendError(res, "Invalid authorization code for your current (old) email address.", null, 400);
      }

      if (pendingRecord.new_email_otp !== newEmailOtp) {
        return sendError(res, "Invalid verification code for your new email address.", null, 400);
      }
    } else {
      const otp = (
        req.body.otp ||
        req.body.otp_code ||
        req.body.otpCode ||
        ""
      ).toString().trim();

      if (!otp) {
        return sendError(res, "OTP code is required to verify profile update.", null, 400);
      }

      if (pendingRecord.otp_code !== otp) {
        return sendError(res, "Invalid OTP code. Please enter the correct code sent to your email.", null, 400);
      }
    }

    const updateData = typeof pendingRecord.update_data === "string"
      ? JSON.parse(pendingRecord.update_data)
      : pendingRecord.update_data;

    // Apply update to user in database
    const updatedUser = await updateUser(userId, updateData);
    if (!updatedUser) {
      return sendError(res, "Failed to update user profile.", null, 500);
    }

    // Delete pending OTP record after successful update
    await deleteUserUpdateOtp(userId);

    // Enrich with BMI analysis
    enrichUserWithBMI(updatedUser);

    // Remove sensitive metadata fields
    delete updatedUser.password;
    delete updatedUser.refresh_token;
    delete updatedUser.created_at;
    delete updatedUser.updated_at;

    return sendSuccess(res, "User profile updated successfully.", updatedUser, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Unified Edit Profile Controller (Supports both 1-step and 2-step flows):
 * - If OTP is passed: verifies OTP(s) and commits the updates.
 * - If OTP is omitted: generates OTP(s), stores pending update, and emails the code(s).
 */
const editUserProfile = async (req, res, next) => {
  const hasOtp = req.body && (
    req.body.otp ||
    req.body.old_email_otp ||
    req.body.oldEmailOtp ||
    req.body.oldOtp ||
    req.body.new_email_otp ||
    req.body.newEmailOtp
  );

  if (hasOtp) {
    return verifyUserProfileUpdateOtp(req, res, next);
  }
  return requestUserProfileUpdate(req, res, next);
};

/**
 * AI BMI Report Controller (GET & POST /api/user/ai-bmi-report)
 * Generates or retrieves an AI-powered personalized BMI Health and Nutrition Report.
 * - Supports `?refresh=true` to force a new AI generation with Gemini.
 * - Supports optional body parameters `{ weight, height, age, blood_group, health_problem }` to preview without saving.
 */
const getAIBmiReport = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const user = await findUserById(userId);
    if (!user) {
      return sendError(res, "User not found.", null, 404);
    }

    const {
      weight,
      height,
      age,
      blood_group,
      health_problem,
    } = req.body || {};

    const isCustomMetric = weight !== undefined || height !== undefined || age !== undefined;
    const forceRefresh = req.query.refresh === "true" || req.body?.refresh === true;

    // Return cached report if available, no custom metric, and no refresh requested
    if (!isCustomMetric && !forceRefresh && user.ai_bmi_report) {
      const existingReport = typeof user.ai_bmi_report === "string"
        ? JSON.parse(user.ai_bmi_report)
        : user.ai_bmi_report;
      return sendSuccess(res, "AI BMI report retrieved from profile cache.", existingReport, 200);
    }

    // Determine final values from request or user profile
    const finalWeight = weight !== undefined ? parseFloat(weight) : (user.weight ? parseFloat(user.weight) : null);
    const finalHeight = height !== undefined ? parseFloat(height) : (user.height ? parseFloat(user.height) : null);
    const finalAge = age !== undefined ? parseInt(age, 10) : user.age;
    const finalBloodGroup = blood_group !== undefined ? blood_group : user.blood_group;
    const finalHealthProblem = health_problem !== undefined ? health_problem : user.health_problem;

    if (!finalWeight || !finalHeight) {
      return sendError(
        res,
        "Weight and height are required to generate an AI BMI report. Please update your profile with weight and height first.",
        null,
        400
      );
    }

    const calculatedBmi = calculateBMI(finalWeight, finalHeight);
    const bmiCategory = getBMICategory(calculatedBmi);

    const userDetailsForAi = {
      first_name: user.first_name || user.username || "User",
      age: finalAge,
      weight: finalWeight,
      height: finalHeight,
      bmi: calculatedBmi,
      bmi_category: bmiCategory,
      blood_group: finalBloodGroup,
      health_problem: finalHealthProblem,
    };

    // Generate report using Gemini AI
    const aiReport = await generateAIBmiReport(userDetailsForAi);

    // Save to user profile if generated for their actual profile
    if (!isCustomMetric) {
      await saveUserAIBmiReport(userId, aiReport);
    }

    return sendSuccess(
      res,
      "AI BMI analysis report generated successfully.",
      aiReport,
      200
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  editUserProfile,
  requestUserProfileUpdate,
  verifyUserProfileUpdateOtp,
  getAIBmiReport,
};



