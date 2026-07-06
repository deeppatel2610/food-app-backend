const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { 
  createPost, 
  getCommunityFeed, 
  toggleLike, 
  addComment,
  getUserPosts
} = require("../controller/postController");
const { verifyToken } = require("../middleware/authMiddleware");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/community");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  }
});

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Community
 *   description: Community transformation feed sharing and interactions
 */

/**
 * @swagger
 * /community:
 *   get:
 *     summary: Retrieve community transformation feed (Protected by JWT)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Community feed retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", verifyToken, getCommunityFeed);

/**
 * @swagger
 * /community:
 *   post:
 *     summary: Publish a weight / diet transformation progress post (Protected by JWT)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [caption, before_image, after_image]
 *             properties:
 *               caption:
 *                 type: string
 *                 description: Post caption detailing progress
 *               before_metric:
 *                 type: string
 *                 description: Metric before transformation (e.g. 85 kg)
 *               after_metric:
 *                 type: string
 *                 description: Metric after transformation (e.g. 72 kg)
 *               before_image:
 *                 type: string
 *                 format: binary
 *                 description: Photo before transformation
 *               after_image:
 *                 type: string
 *                 format: binary
 *                 description: Photo after transformation
 *     responses:
 *       201:
 *         description: Post published successfully
 *       400:
 *         description: Bad request (missing fields or images)
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/", 
  verifyToken, 
  upload.fields([
    { name: "before_image", maxCount: 1 },
    { name: "after_image", maxCount: 1 }
  ]), 
  createPost
);

/**
 * @swagger
 * /community/{postId}/like:
 *   post:
 *     summary: Toggle post like status (Protected by JWT)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Like status toggled successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/:postId/like", verifyToken, toggleLike);

/**
 * @swagger
 * /community/{postId}/comment:
 *   post:
 *     summary: Add a comment to a post (Protected by JWT)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 description: Text content of the comment
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/:postId/comment", verifyToken, addComment);

/**
 * @swagger
 * /community/my-posts:
 *   get:
 *     summary: Retrieve posts published by the authenticated user (Protected by JWT)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User posts retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/my-posts", verifyToken, getUserPosts);

module.exports = router;
