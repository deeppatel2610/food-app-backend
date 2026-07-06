const express = require("express");
const router = express.Router();
const { getUserProfile, editUserProfile } = require("../controller/userController");
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
 *     summary: Update Authenticated User details (Protected by JWT)
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
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid input or user/email already registered
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       404:
 *         description: User not found
 */
router.put("/", verifyToken, editUserProfile);

module.exports = router;
