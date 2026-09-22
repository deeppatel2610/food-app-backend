const express = require("express");
const router = express.Router();
const {
  getUserProfile,
  editUserProfile,
  requestUserProfileUpdate,
  verifyUserProfileUpdateOtp,
  getAIBmiReport,
} = require("../controller/userController");
const { verifyToken } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User profile and management endpoints
 */

/**
 * @swagger
 * /user:
 *   get:
 *     summary: Get Authenticated User details (Protected by JWT)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       404:
 *         description: User not found
 */
router.get("/", verifyToken, getUserProfile);

/**
 * @swagger
 * /user:
 *   put:
 *     summary: Update Authenticated User details with OTP verification (Unified API)
 *     description: |
 *       **Unified 2-in-1 Endpoint:**
 *       1. **Without `otp` field:** Validates user details, generates 6-digit OTP, saves pending changes, and emails the OTP.
 *       2. **With `otp` field:** Verifies the 6-digit OTP code against pending changes, updates the database, and returns the updated user object.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               otp:
 *                 type: string
 *                 description: "6-digit OTP code received in email (Provide this to finalize update)"
 *                 example: "123456"
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               age:
 *                 type: integer
 *                 example: 25
 *               weight:
 *                 type: number
 *                 format: float
 *                 example: 70.5
 *               height:
 *                 type: number
 *                 format: float
 *                 example: 175.0
 *               blood_group:
 *                 type: string
 *                 example: O+
 *               health_problem:
 *                 type: string
 *                 example: None
 *     responses:
 *       200:
 *         description: Either OTP dispatched or profile successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error, duplicate username/email, or invalid/expired OTP
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       404:
 *         description: User or pending update request not found
 */
router.put("/", verifyToken, editUserProfile);
router.put("/update", verifyToken, editUserProfile);

/**
 * @swagger
 * /user/send-update-otp:
 *   post:
 *     summary: Step 1 - Submit user profile changes and dispatch email OTP
 *     description: Validates profile fields, generates a 6-digit OTP, stores pending update details, and sends verification code to email.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               age:
 *                 type: integer
 *                 example: 25
 *               weight:
 *                 type: number
 *                 format: float
 *                 example: 70.5
 *               height:
 *                 type: number
 *                 format: float
 *                 example: 175.0
 *               blood_group:
 *                 type: string
 *                 example: O+
 *               health_problem:
 *                 type: string
 *                 example: None
 *     responses:
 *       200:
 *         description: Verification OTP sent to user's email
 *       400:
 *         description: Validation error or username/email already taken
 *       401:
 *         description: Unauthorized
 */
router.post("/send-update-otp", verifyToken, requestUserProfileUpdate);

/**
 * @swagger
 * /user/verify-update-otp:
 *   post:
 *     summary: Step 2 - Verify OTP and apply pending profile updates
 *     description: Verifies the 6-digit OTP code sent to user's email. Upon success, applies all pending updates to database and returns updated user profile.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               otp:
 *                 type: string
 *                 description: "6-digit OTP code (used when email is NOT changed)"
 *                 example: "123456"
 *               old_email_otp:
 *                 type: string
 *                 description: "6-digit authorization OTP sent to current (old) email (required when email is changed)"
 *                 example: "111111"
 *               new_email_otp:
 *                 type: string
 *                 description: "6-digit verification OTP sent to new email address (required when email is changed)"
 *                 example: "222222"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid or expired OTP code
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No pending profile update found
 */
router.post("/verify-update-otp", verifyToken, verifyUserProfileUpdateOtp);

/**
 * @swagger
 * /user/ai-bmi-report:
 *   get:
 *     summary: Get or Generate AI-powered personalized BMI Health Report (Protected by JWT)
 *     description: |
 *       Generates a comprehensive, personalized health, nutrition, and exercise report based on the user's BMI, age, weight, height, blood group, and health conditions using Google Gemini AI.
 *       - Returns cached report if already generated.
 *       - Pass `?refresh=true` to force a fresh regeneration by Gemini AI.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Set true to force Gemini AI to regenerate a fresh report
 *     responses:
 *       200:
 *         description: AI BMI report retrieved or generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: User profile missing height or weight
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Generate or Preview AI BMI Report with custom metrics (Protected by JWT)
 *     description: Generates an AI BMI report using custom/updated metrics or re-generates for current profile.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weight:
 *                 type: number
 *                 example: 72.5
 *               height:
 *                 type: number
 *                 example: 175.0
 *               age:
 *                 type: integer
 *                 example: 25
 *               blood_group:
 *                 type: string
 *                 example: "O+"
 *               health_problem:
 *                 type: string
 *                 example: "None"
 *               refresh:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: AI BMI analysis report generated successfully
 *       400:
 *         description: Missing height or weight
 *       401:
 *         description: Unauthorized
 */
router.get("/ai-bmi-report", verifyToken, getAIBmiReport);
router.post("/ai-bmi-report", verifyToken, getAIBmiReport);

module.exports = router;


