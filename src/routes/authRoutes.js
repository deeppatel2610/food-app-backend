const express = require("express");
const router = express.Router();
const {
  register,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  googleAuth,
} = require("../controller/authController");

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User registration, OTP verification, and authentication endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Step 1 - Submit user registration details and dispatch email OTP
 *     description: Validates user details and sends a 6-digit OTP to the user's email address. The user is NOT inserted into the database until the OTP is verified.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: OTP code sent to user email successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Verification code has been sent to your email. Please verify OTP to complete registration.
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: john@example.com
 *                     expiresInMinutes:
 *                       type: integer
 *                       example: 10
 *       400:
 *         description: Validation error or email/username already taken
 */
router.post("/register", register);
router.post("/send-otp", register);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Step 2 - Verify OTP and create user in database
 *     description: Verifies the 6-digit OTP code sent to user's email. Upon successful verification, officially creates the user record in the database and returns JWT authentication tokens.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: OTP verified and user created successfully in database
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid or expired OTP code
 *       404:
 *         description: No pending registration found for this email
 */
router.post("/verify-otp", verifyOtp);
router.post("/verify-registration-otp", verifyOtp);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend a fresh registration verification OTP code
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: A fresh OTP code was dispatched to email
 *       400:
 *         description: Missing email address
 *       404:
 *         description: No pending registration found for this email
 */
router.post("/resend-otp", resendOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login (Returns userId and tokens)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful, returns userId, accessToken (1h), and refreshToken (7d)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized (invalid credentials)
 */
router.post("/login", login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh Access Token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated successfully
 *       403:
 *         description: Invalid or expired refresh token
 */
router.post("/refresh", refresh);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request Password Reset (Dispatches 6-digit code and link via email)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Password reset code and link sent successfully
 *       400:
 *         description: Bad request (invalid email format)
 *       404:
 *         description: User not found
 */
router.post("/forgot-password", forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset User Password (Supports 6-digit code or JWT token, and returns login tokens)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               email:
 *                 type: string
 *                 description: User email (required when using 6-digit code)
 *                 example: john@example.com
 *               otp:
 *                 type: string
 *                 description: 6-digit reset code received via email
 *                 example: "123456"
 *               token:
 *                 type: string
 *                 description: Alternatively, the full JWT reset token string
 *                 example: "eyJhbGciOi..."
 *               password:
 *                 type: string
 *                 description: New password (minimum 6 characters)
 *                 example: "newSecret123"
 *     responses:
 *       200:
 *         description: Password reset successfully, returns accessToken and refreshToken
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid/expired code/token or password too short
 *       404:
 *         description: User not found
 */
router.post("/reset-password", resetPassword);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Google Authentication (Sign-In / Sign-Up)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: The Google ID token received from client-side Google SDK. Required in production.
 *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6IjFhMmIzY...
 *               googleId:
 *                 type: string
 *                 description: Direct Google Sub/ID for bypass in development mode.
 *                 example: "110169484474386276334"
 *               email:
 *                 type: string
 *                 description: Direct email for bypass in development mode.
 *                 example: john.doe@gmail.com
 *               firstName:
 *                 type: string
 *                 description: Direct first name for bypass in development mode.
 *                 example: John
 *               lastName:
 *                 type: string
 *                 description: Direct last name for bypass in development mode.
 *                 example: Doe
 *               bypassVerification:
 *                 type: boolean
 *                 description: Set to true to bypass Google API token verification (Only allowed in development/test environment).
 *                 example: false
 *     responses:
 *       200:
 *         description: Authentication successful. Returns JWT access & refresh tokens and user ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Google authentication successful.
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                       example: 12
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refreshToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     isNewUser:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Bad Request (missing required parameters or configuration issues)
 *       401:
 *         description: Unauthorized (invalid/expired Google ID token)
 */
router.post("/google", googleAuth);

module.exports = router;
