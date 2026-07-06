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
} = require("../models/userModel");
const { calculateBMI, enrichUserWithBMI } = require("../utils/bmiHelper");
const { validateUserFields } = require("../utils/validationHelper");

/**
 * User Registration Controller
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

    // Check if user already exists
    const existingUser = await findUserByEmailOrUsername(email, username);
    if (existingUser) {
      if (existingUser.email === email) {
        return sendError(res, "Email is already registered.", null, 400);
      }
      if (existingUser.username === username) {
        return sendError(res, "Username is already taken.", null, 400);
      }
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculate BMI if height and weight provided
    const bmi = calculateBMI(weight, height);

    // Create User in Database
    const newUser = await createUser({
      first_name,
      last_name,
      username,
      email,
      password: hashedPassword,
      age,
      weight,
      height,
      bmi,
      blood_group,
      health_problem,
    });

    enrichUserWithBMI(newUser);
    return sendSuccess(res, "User registered successfully.", newUser, 201);
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
    const jwtSecret = envVariables.JWT || "default_jwt_secret_key";

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

    const jwtSecret = envVariables.JWT || "default_jwt_secret_key";
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
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, "Email is required.", null, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, "Please provide a valid email address.", null, 400);
    }

    const user = await findUserByEmailOrUsername(email, "");
    if (!user) {
      return sendError(res, "User with this email does not exist.", null, 404);
    }

    // Generate a stateless reset token signed with JWT_SECRET + user.password hash, expiring in 15 mins
    const jwtSecret = envVariables.JWT || "default_jwt_secret_key";
    const secret = jwtSecret + user.password;

    const resetToken = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: "15m" }
    );

    const resetLink = `http://${envVariables.HOST || "localhost"}:${envVariables.PORT || 3000}/api/auth/reset-password?token=${resetToken}`;
    
    // Simulate sending email
    console.log(`\n--- [SIMULATED EMAIL SENT] ---`);
    console.log(`To: ${user.email}`);
    console.log(`Subject: Password Reset Link`);
    console.log(`Link: ${resetLink}`);
    console.log(`-----------------------------\n`);

    return sendSuccess(res, "Password reset token generated successfully. (Check terminal/logs or response data in dev mode.)", {
      resetToken,
      resetLink,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password Controller
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return sendError(res, "Token and new password are required.", null, 400);
    }

    if (password.length < 6) {
      return sendError(res, "Password must be at least 6 characters long.", null, 400);
    }

    // Decode token to get user ID without verification first
    let decoded;
    try {
      decoded = jwt.decode(token);
      if (!decoded || !decoded.userId) {
        return sendError(res, "Invalid password reset token format.", null, 400);
      }
    } catch (err) {
      return sendError(res, "Invalid password reset token format.", null, 400);
    }

    const user = await findUserById(decoded.userId);
    if (!user) {
      return sendError(res, "User not found.", null, 404);
    }

    // Verify token using JWT_SECRET + current password hash
    const jwtSecret = envVariables.JWT || "default_jwt_secret_key";
    const secret = jwtSecret + user.password;

    try {
      jwt.verify(token, secret);
    } catch (err) {
      return sendError(res, "Invalid or expired password reset token.", null, 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save new password and clear refresh token
    await updateUserPassword(user.id, hashedPassword);

    return sendSuccess(res, "Password has been reset successfully.", null);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  forgotPassword,
  resetPassword,
};
