const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const envVariables = require("../utils/envVariables");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const {
  findUserByEmailOrUsername,
  findUserById,
  createUser,
  updateUserLoginStatus,
} = require("../models/userModel");
const { calculateBMI, enrichUserWithBMI } = require("../utils/bmiHelper");

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
    if (!username || !email || !password) {
      return sendError(
        res,
        "Username, email, and password are required fields.",
        null,
        400,
      );
    }

    // Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, "Please provide a valid email address.", null, 400);
    }

    if (age !== undefined && age !== null && age !== "") {
      const parsedAge = parseInt(age, 10);
      if (isNaN(parsedAge) || parsedAge <= 0) {
        return sendError(res, "Age must be a positive number.", null, 400);
      }
    }

    if (weight !== undefined && weight !== null && weight !== "") {
      const parsedWeight = parseFloat(weight);
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        return sendError(res, "Weight must be a positive number.", null, 400);
      }
    }

    if (height !== undefined && height !== null && height !== "") {
      const parsedHeight = parseFloat(height);
      if (isNaN(parsedHeight) || parsedHeight <= 0) {
        return sendError(res, "Height must be a positive number.", null, 400);
      }
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

module.exports = {
  register,
  login,
  refresh,
};
