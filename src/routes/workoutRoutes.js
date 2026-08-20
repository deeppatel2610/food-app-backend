const express = require("express");
const router = express.Router();
const {
  fetchWorkoutTypes,
  startWorkout,
  fetchActiveWorkout,
  saveLocations,
  fetchWorkoutLocations,
  stopWorkout,
  fetchWorkoutHistory,
  cleanLocations,
} = require("../controller/workoutController");

const { verifyToken } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Workout
 *   description: Workout tracking and type management endpoints
 */

/**
 * @swagger
 * /workout/types:
 *   get:
 *     summary: Retrieve list of all workout types (Protected by JWT)
 *     tags: [Workout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workout types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       403:
 *         description: Forbidden (invalid JWT signature)
 *       500:
 *         description: Internal Server Error
 */
router.get("/types", verifyToken, fetchWorkoutTypes);

/**
 * @swagger
 * /workout/active:
 *   get:
 *     summary: Retrieve user's currently active workout session (Protected by JWT)
 *     tags: [Workout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active workout retrieved successfully (or null if none)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
router.get("/active", verifyToken, fetchActiveWorkout);

/**
 * @swagger
 * /workout/start:
 *   post:
 *     summary: Start a new workout session (Protected by JWT)
 *     tags: [Workout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workoutTypeId
 *             properties:
 *               workoutTypeId:
 *                 type: integer
 *                 description: ID of the workout type selected by user
 *                 example: 1
 *               status:
 *                 type: string
 *                 description: Initial status of workout session
 *                 example: "in_progress"
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Optional start timestamp (defaults to server current time)
 *                 example: "2026-08-20T12:00:00Z"
 *     responses:
 *       201:
 *         description: Workout session created/started successfully
 *       400:
 *         description: Bad Request (missing workoutTypeId)
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       404:
 *         description: Workout type not found
 *       409:
 *         description: Conflict - Active workout already in progress
 *       500:
 *         description: Internal Server Error
 */
router.post("/start", verifyToken, startWorkout);

/**
 * @swagger
 * /workout/location:
 *   post:
 *     summary: Store a batch of GPS location points for an active workout session (Protected by JWT)
 *     tags: [Workout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workoutId
 *               - locations
 *             properties:
 *               workoutId:
 *                 type: integer
 *                 description: ID of active workout
 *                 example: 1
 *               locations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     altitude:
 *                       type: number
 *                     speed:
 *                       type: number
 *                     accuracy:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       200:
 *         description: Locations stored successfully
 *       400:
 *         description: Missing workoutId or locations array
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
router.post("/location", verifyToken, saveLocations);

/**
 * @swagger
 * /workout/locations/{workoutId}:
 *   get:
 *     summary: Retrieve recorded GPS route locations for a specific workout (Protected by JWT)
 *     tags: [Workout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the workout
 *     responses:
 *       200:
 *         description: Workout location points retrieved successfully
 *       400:
 *         description: Missing workoutId
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
router.get("/locations/:workoutId", verifyToken, fetchWorkoutLocations);

/**
 * @swagger
 * /workout/stop:
 *   post:
 *     summary: Complete a workout session and store final metrics (Protected by JWT)
 *     tags: [Workout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workoutId
 *             properties:
 *               workoutId:
 *                 type: integer
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               durationSeconds:
 *                 type: number
 *               distanceMeters:
 *                 type: number
 *               caloriesBurned:
 *                 type: number
 *               elevationGainMeters:
 *                 type: number
 *               averageSpeedMps:
 *                 type: number
 *               averagePaceSecPerKm:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Workout session completed successfully
 *       400:
 *         description: Missing workoutId
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workout session not found
 *       500:
 *         description: Internal Server Error
 */
router.post("/stop", verifyToken, stopWorkout);

/**
 * @swagger
 * /workout/history:
 *   get:
 *     summary: Retrieve user's completed workout history log (Protected by JWT)
 *     tags: [Workout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workout history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       500:
 *         description: Internal Server Error
 */
router.get("/history", verifyToken, fetchWorkoutHistory);

/**
 * @swagger
 * /workout/locations/cleanup:
 *   delete:
 *     summary: Manually delete all workout_locations records (Protected by JWT)
 *     tags: [Workout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: workout_locations table cleared successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
router.delete("/locations/cleanup", verifyToken, cleanLocations);

module.exports = router;
