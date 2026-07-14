const express = require("express");
const router = express.Router();
const { register, login, refresh, forgotPassword, resetPassword, googleAuth } = require("../controller/authController");

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User registration and authentication endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request (validation error or user already exists)
 */
router.post("/register", register);

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
 *     summary: Request Password Reset Token (Simulated email)
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
 *         description: Reset token generated successfully
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
 *     summary: Reset User Password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 example: newsecret123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid/expired token or password too short
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
