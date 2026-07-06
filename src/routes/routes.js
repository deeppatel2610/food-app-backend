const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const foodRoutes = require("./foodRoutes");
const communityRoutes = require("./postRoutes");

/**
 * @swagger
 * /health:
 *   get:
 *     summary: API Health Check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running smoothly
 */
router.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "API is running smooth!" });
});

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/food", foodRoutes);
router.use("/community", communityRoutes);

module.exports = router;
