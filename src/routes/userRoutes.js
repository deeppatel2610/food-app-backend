const express = require("express");
const router = express.Router();
const { getUserProfile } = require("../controller/userController");
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

module.exports = router;
