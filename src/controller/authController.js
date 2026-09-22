const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const envVariables = require("../utils/envVariables");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const {
  findUserByEmailOrUsername,
  findUserById,
  createUser,
  updateUserLoginStatus,
  updateUserPassword,
  findUserByGoogleId,
  findUserByEmail,
  linkGoogleId,
} = require("../models/userModel");
const {
  saveOtpVerification,
  findOtpByEmail,
  updateOtpCode,
  deleteOtpByEmail,
} = require("../models/otpModel");
const { verifyGoogleIdToken } = require("../utils/googleAuthHelper");
const { calculateBMI, enrichUserWithBMI } = require("../utils/bmiHelper");
const { validateUserFields } = require("../utils/validationHelper");
const { sendPasswordResetEmail, sendOtpEmail } = require("../utils/emailHelper");

/**
 * Step 1: User Registration Controller
 * Validates details, generates a 6-digit OTP, stores pending registration data,
 * and sends an OTP verification code to the user's email.
 * The user is NOT inserted into the users database until OTP is verified.
 */
const register = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      username,
      email,
      password,
      age,
      weight,
      height,
      blood_group,
      health_problem,
    } = req.body;

    // Validation
    const validationResult = validateUserFields(req.body, false);
    if (!validationResult.isValid) {
      return sendError(res, validationResult.error, null, 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim() : null;

    // Check if user already exists in DB
    const existingUser = await findUserByEmailOrUsername(cleanEmail, cleanUsername);
    if (existingUser) {
      if (existingUser.email?.toLowerCase() === cleanEmail) {
        return sendError(res, "Email is already registered.", null, 400);
      }
      if (existingUser.username && cleanUsername && existingUser.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return sendError(res, "Username is already taken.", null, 400);
      }
    }

    // Hash Password for secure temporary storage
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculate BMI if height and weight provided
    const bmi = calculateBMI(weight, height);

    // Prepare pending user data
    const pendingUserData = {
      first_name: first_name || null,
      last_name: last_name || null,
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      age: age !== undefined ? age : null,
      weight: weight !== undefined ? weight : null,
      height: height !== undefined ? height : null,
      bmi: bmi || null,
      blood_group: blood_group || null,
      health_problem: health_problem || null,
    };

    // Generate secure 6-digit OTP code (100000 - 999999)
    const otpCode = crypto.randomInt(100000, 1000000).toString();

    // Store in temporary OTP table (Valid for 10 minutes)
    await saveOtpVerification(cleanEmail, otpCode, pendingUserData, 10);

    // Send OTP via Email
    await sendOtpEmail(cleanEmail, otpCode, first_name || cleanUsername || "User");

    const isDev = process.env.NODE_ENV === "development";
    return sendSuccess(
      res,
      "Verification code has been sent to your email. Please verify OTP to complete registration.",
      {
        email: cleanEmail,
        expiresInMinutes: 10,
        ...(isDev ? { devOtp: otpCode } : {}),
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Step 2: Verify Registration OTP Controller
 * Verifies the 6-digit OTP code sent to user's email.
 * Upon successful verification, the user record is officially created in the database,
 * and JWT authentication tokens (access & refresh) are issued.
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendError(res, "Email and OTP code are required.", null, 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Retrieve pending OTP record
    const otpRecord = await findOtpByEmail(cleanEmail);
    if (!otpRecord) {
      return sendError(
        res,
        "No pending registration found for this email. Please submit your registration details first.",
        null,
        404
      );
    }

    // Check expiration (10 minutes)
    if (new Date() > new Date(otpRecord.expires_at)) {
      return sendError(
        res,
        "The OTP code has expired. Please request a new code using the resend option.",
        null,
        400
      );
    }

    // Verify OTP code match
    if (otpRecord.otp_code !== cleanOtp) {
      return sendError(
        res,
        "Invalid verification code. Please check your code and try again.",
        null,
        400
      );
    }

    const userData = typeof otpRecord.user_data === "string"
      ? JSON.parse(otpRecord.user_data)
      : otpRecord.user_data;

    // Double-check collision in users table
    const existingUser = await findUserByEmailOrUsername(userData.email, userData.username);
    if (existingUser) {
      await deleteOtpByEmail(cleanEmail);
      if (existingUser.email?.toLowerCase() === cleanEmail) {
        return sendError(res, "Email is already registered.", null, 400);
      }
      if (existingUser.username && userData.username && existingUser.username.toLowerCase() === userData.username.toLowerCase()) {
        return sendError(res, "Username is already taken.", null, 400);
      }
    }

    // Official creation of User record in PostgreSQL Database
    const newUser = await createUser(userData);

    // Delete verified OTP record
    await deleteOtpByEmail(cleanEmail);

    // Issue JWT tokens
    const jwtSecret = envVariables.JWT;
    if (!jwtSecret) {
      return sendError(
        res,
        "Internal server configuration error. JWT key missing.",
        null,
        500
      );
    }

    const accessToken = jwt.sign(
      { userId: newUser.id, username: newUser.username, email: newUser.email },
      jwtSecret,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign({ userId: newUser.id }, jwtSecret, {
      expiresIn: "7d",
    });

    // Update user login status & refresh token in DB
    await updateUserLoginStatus(newUser.id, refreshToken, true);

    enrichUserWithBMI(newUser);

    return sendSuccess(
      res,
      "Email verified and user registered successfully.",
      {
        userId: newUser.id,
        user: newUser,
        accessToken,
        refreshToken,
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Resend Registration OTP Controller
 * Generates a fresh 6-digit OTP code and dispatches it via email for pending registrations.
 */
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, "Email is required.", null, 400);
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if pending verification exists
    const otpRecord = await findOtpByEmail(cleanEmail);
    if (!otpRecord) {
      return sendError(
        res,
        "No pending registration found for this email. Please submit your registration details first.",
        null,
        404
      );
    }

    const userData = typeof otpRecord.user_data === "string"
      ? JSON.parse(otpRecord.user_data)
      : otpRecord.user_data;

    // Generate fresh 6-digit OTP code
    const newOtp = crypto.randomInt(100000, 1000000).toString();

    // Update record with new OTP & refresh 10-minute expiry
    await updateOtpCode(cleanEmail, newOtp, 10);

    // Dispatch email
    await sendOtpEmail(cleanEmail, newOtp, userData.first_name || userData.username || "User");

    const isDev = process.env.NODE_ENV === "development";
    return sendSuccess(
      res,
      "A fresh verification code has been sent to your email.",
      {
        email: cleanEmail,
        expiresInMinutes: 10,
        ...(isDev ? { devOtp: newOtp } : {}),
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * User Login Controller (Returns only tokens & userId)
 * Access Token validity: 1 Hour ("1h")
 * Refresh Token validity: 7 Days ("7d")
 */
const login = async (req, res, next) => {
  try {
    const { identifier, email, username, password } = req.body;
    const userIdentifier = identifier || email || username;

    if (!userIdentifier || !password) {
      return sendError(
        res,
        "Email/Username and password are required.",
        null,
        400,
      );
    }

    // Find User
    const user = await findUserByEmailOrUsername(
      userIdentifier,
      userIdentifier,
    );
    if (!user) {
      return sendError(res, "Invalid email/username or password.", null, 401);
    }

    // Compare Password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return sendError(res, "Invalid email/username or password.", null, 401);
    }

    // Secret Key for JWT
    const jwtSecret = envVariables.JWT;
    if (!jwtSecret) {
      return sendError(
        res,
        "Internal server configuration error. JWT key missing.",
        null,
        500,
      );
    }

    // Generate Access Token (1 Hour) & Refresh Token (7 Days)
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "7d",
    });

    // Update user login status & refresh token in DB
    await updateUserLoginStatus(user.id, refreshToken, true);

    // Send ONLY userId and Tokens in response
    return sendSuccess(res, "Login successful.", {
      userId: user.id,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh Access Token Controller
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return sendError(res, "Refresh token is required.", null, 400);
    }

    const jwtSecret = envVariables.JWT;
    if (!jwtSecret) {
      return sendError(
        res,
        "Internal server configuration error. JWT key missing.",
        null,
        500,
      );
    }
    const decoded = jwt.verify(refreshToken, jwtSecret);

    const user = await findUserById(decoded.userId);
    if (!user || user.refresh_token !== refreshToken) {
      return sendError(res, "Invalid or revoked refresh token.", null, 403);
    }

    // Generate new Access Token (1 Hour)
    const newAccessToken = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    return sendSuccess(res, "Token refreshed successfully.", {
      accessToken: newAccessToken,
    });
  } catch (error) {
    return sendError(res, "Invalid or expired refresh token.", null, 403);
  }
};

/**
 * Forgot Password Controller
 * Generates a 6-digit Reset Code and a JWT Reset Token, stores the reset code
 * in the database for 15 minutes, and sends a password reset email to the user.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, "Email is required.", null, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return sendError(res, "Please provide a valid email address.", null, 400);
    }

    const user = await findUserByEmailOrUsername(cleanEmail, "");
    if (!user) {
      return sendError(res, "User with this email does not exist.", null, 404);
    }

    // 1. Generate 6-digit Reset Code (100000 - 999999)
    const resetCode = crypto.randomInt(100000, 1000000).toString();

    // 2. Generate a stateless reset token signed with JWT_SECRET + user.password hash, expiring in 15 mins
    const jwtSecret = envVariables.JWT;
    if (!jwtSecret) {
      return sendError(
        res,
        "Internal server configuration error. JWT key missing.",
        null,
        500,
      );
    }
    const secret = jwtSecret + user.password;

    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, resetCode },
      secret,
      { expiresIn: "15m" },
    );

    // Save pending reset code in otp_verifications table for 15 minutes
    await saveOtpVerification(cleanEmail, resetCode, { type: "password_reset", userId: user.id }, 15);

    const resetLink = `http://${envVariables.HOST || "localhost"}:${envVariables.PORT || 3001}/api/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

    // Dispatch reset email with both the 6-digit Reset Code and link
    await sendPasswordResetEmail(
      user.email,
      resetLink,
      user.first_name || user.username || "User",
      resetCode,
    );

    const isDev = envVariables.NODE_ENV !== "production";
    const responseData = {
      email: cleanEmail,
      expiresInMinutes: 15,
      ...(isDev ? { devResetCode: resetCode, resetToken, resetLink } : {}),
    };

    return sendSuccess(
      res,
      "Password reset code has been sent to your email.",
      responseData,
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password Controller
 * Supports resetting password via 6-digit Reset Code OR JWT reset token.
 * Upon successful reset, updates password and issues fresh login tokens (accessToken & refreshToken).
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, otp, code, email, password } = req.body;
    const resetIdentifier = token || otp || code;

    if (!resetIdentifier || !password) {
      return sendError(res, "Reset token/code and new password are required.", null, 400);
    }

    if (password.length < 6) {
      return sendError(
        res,
        "Password must be at least 6 characters long.",
        null,
        400,
      );
    }

    let user = null;
    const cleanIdentifier = String(resetIdentifier).trim();

    // Check if resetIdentifier is a 6-digit code
    if (/^\d{6}$/.test(cleanIdentifier)) {
      if (!email) {
        return sendError(res, "Email is required when using a 6-digit reset code.", null, 400);
      }
      const cleanEmail = email.trim().toLowerCase();
      const otpRecord = await findOtpByEmail(cleanEmail);
      if (!otpRecord) {
        return sendError(res, "Invalid or expired password reset code. Please request a new code.", null, 400);
      }
      if (new Date() > new Date(otpRecord.expires_at)) {
        await deleteOtpByEmail(cleanEmail);
        return sendError(res, "The reset code has expired. Please request a new code.", null, 400);
      }
      if (otpRecord.otp_code !== cleanIdentifier) {
        return sendError(res, "Invalid password reset code. Please check and try again.", null, 400);
      }

      const userData = typeof otpRecord.user_data === "string" ? JSON.parse(otpRecord.user_data) : otpRecord.user_data;
      user = await findUserById(userData.userId);
      if (!user) {
        return sendError(res, "User not found.", null, 404);
      }
      // Delete used OTP record
      await deleteOtpByEmail(cleanEmail);
    } else {
      // Decode JWT reset token to get user ID
      let decoded;
      try {
        decoded = jwt.decode(cleanIdentifier);
        if (!decoded || !decoded.userId) {
          return sendError(
            res,
            "Invalid password reset token format.",
            null,
            400,
          );
        }
      } catch (err) {
        return sendError(res, "Invalid password reset token format.", null, 400);
      }

      user = await findUserById(decoded.userId);
      if (!user) {
        return sendError(res, "User not found.", null, 404);
      }

      // Verify token using JWT_SECRET + current password hash
      const jwtSecret = envVariables.JWT;
      if (!jwtSecret) {
        return sendError(
          res,
          "Internal server configuration error. JWT key missing.",
          null,
          500,
        );
      }
      const secret = jwtSecret + user.password;

      try {
        jwt.verify(cleanIdentifier, secret);
      } catch (err) {
        return sendError(
          res,
          "Invalid or expired password reset token.",
          null,
          400,
        );
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save new password in DB
    await updateUserPassword(user.id, hashedPassword);

    // Generate fresh JWT login tokens (accessToken & refreshToken)
    const jwtSecret = envVariables.JWT;
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "7d",
    });

    // Update user login status & refresh token in DB
    await updateUserLoginStatus(user.id, refreshToken, true);

    const updatedUser = await findUserById(user.id);
    enrichUserWithBMI(updatedUser);

    return sendSuccess(
      res,
      "Password has been reset successfully. You are now logged in.",
      {
        userId: user.id,
        user: updatedUser,
        accessToken,
        refreshToken,
      },
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Google Authentication Controller
 * Verifies ID token, handles automatic account linking and user registration.
 */
const googleAuth = async (req, res, next) => {
  try {
    const {
      idToken,
      googleId,
      email,
      firstName,
      lastName,
      bypassVerification,
    } = req.body;

    let googleUser = null;

    // Developer bypass verification if specified and NOT in production
    if (bypassVerification && envVariables.NODE_ENV !== "production") {
      if (!googleId || !email) {
        return sendError(
          res,
          "googleId and email are required for bypass authentication.",
          null,
          400,
        );
      }
      googleUser = {
        googleId,
        email,
        firstName: firstName || "",
        lastName: lastName || "",
        picture: null,
      };
    } else {
      if (!idToken) {
        return sendError(res, "idToken is required.", null, 400);
      }
      try {
        googleUser = await verifyGoogleIdToken(idToken);
      } catch (err) {
        return sendError(res, err.message, null, 401);
      }
    }

    // Find user by Google ID
    let user = await findUserByGoogleId(googleUser.googleId);

    if (!user) {
      // User not found by Google ID, check by Email to link accounts
      const existingUser = await findUserByEmail(googleUser.email);
      if (existingUser) {
        // Link Google ID to existing user account
        user = await linkGoogleId(existingUser.id, googleUser.googleId);
      } else {
        // Create new user record
        // Google auth users do not have a password or username initially
        user = await createUser({
          first_name: googleUser.firstName,
          last_name: googleUser.lastName,
          email: googleUser.email,
          google_id: googleUser.googleId,
        });
      }
    }

    // Secret Key for JWT
    const jwtSecret = envVariables.JWT;
    if (!jwtSecret) {
      return sendError(
        res,
        "Internal server configuration error. JWT key missing.",
        null,
        500,
      );
    }

    // Generate Access Token (1 Hour) & Refresh Token (7 Days)
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "7d",
    });

    // Update user login status & refresh token in DB
    await updateUserLoginStatus(user.id, refreshToken, true);

    return sendSuccess(res, "Google authentication successful.", {
      userId: user.id,
      accessToken,
      refreshToken,
      isNewUser:
        !user.created_at ||
        Date.now() - new Date(user.created_at).getTime() < 10000,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  googleAuth,
};
