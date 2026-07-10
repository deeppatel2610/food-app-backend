const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const foodRoutes = require("./foodRoutes");
const communityRoutes = require("./postRoutes");

const pool = require("../config/dbInit");

/**
 * @swagger
 * /health:
 *   get:
 *     summary: API Health Check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running smoothly
 *       500:
 *         description: API is running but database is disconnected
 */
router.get("/health", async (req, res) => {
  try {
    // Run simple query to test DB connectivity
    await pool.query("SELECT 1");
    res.status(200).json({ 
      status: "OK", 
      message: "API is running smooth!", 
      database: "Connected" 
    });
  } catch (error) {
    console.error("Health check Database connection failure:", error);
    res.status(500).json({ 
      status: "ERROR", 
      message: "API is active but Database connection failed.", 
      database: "Disconnected",
      error: error.message 
    });
  }
});

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/food", foodRoutes);
router.use("/community", communityRoutes);

module.exports = router;
