const express = require("express");
const multer = require("multer");
const { analyzeFoodImage, getFoodAnalysisHistory, updateFoodIsEatStatus } = require("../controller/foodController");
const { verifyToken } = require("../middleware/authMiddleware");

// Configure multer for in-memory buffer storage (saves disk I/O and speeds up API response)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Food
 *   description: Food analysis and nutrition extraction
 */

/**
 * @swagger
 * /food/analyze:
 *   post:
 *     summary: Analyze food image using Gemini AI (Protected by JWT)
 *     tags: [Food]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: The food image to upload and analyze
 *     responses:
 *       200:
 *         description: Food image analyzed successfully
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       403:
 *         description: Forbidden (invalid JWT signature)
 *       400:
 *         description: Bad request (invalid input or file type)
 *       500:
 *         description: Internal Server Error
 */
router.post("/analyze", verifyToken, upload.single("image"), analyzeFoodImage);

/**
 * @swagger
 * /food/history:
 *   get:
 *     summary: Get food analysis history for the authenticated user (Protected by JWT)
 *     tags: [Food]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Food analysis history retrieved successfully
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       403:
 *         description: Forbidden (invalid JWT signature)
 *       500:
 *         description: Internal Server Error
 */
router.get("/history", verifyToken, getFoodAnalysisHistory);

/**
 * @swagger
 * /food/history/{id}:
 *   patch:
 *     summary: Update the is_eat status of a food analysis record (Protected by JWT)
 *     tags: [Food]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Food analysis record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_eat:
 *                 type: boolean
 *                 description: New is_eat status (true or false)
 *     responses:
 *       200:
 *         description: Eat status updated successfully
 *       400:
 *         description: Bad request (invalid record ID)
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       404:
 *         description: Food analysis record not found or access denied
 *       500:
 *         description: Internal Server Error
 */
router.patch("/history/:id", verifyToken, updateFoodIsEatStatus);

module.exports = router;
