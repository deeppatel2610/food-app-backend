const { sendSuccess, sendError } = require("../utils/responseHandler");
const {
  getWorkoutTypes,
  getWorkoutTypeById,
  getWorkoutById,
  createWorkout,
  saveWorkoutLocations,
  getLocationsByWorkoutId,
  finishWorkout,
  updateWorkoutStatus,
  getWorkoutHistoryByUserId,
  getActiveWorkoutByUserId,
  clearWorkoutLocations,
} = require("../models/workoutModel");

/**
 * GET /workout/types
 * Fetch all available workout types.
 */
const fetchWorkoutTypes = async (req, res) => {
  try {
    const workoutTypes = await getWorkoutTypes();
    return sendSuccess(res, "Workout types retrieved successfully.", workoutTypes, 200);
  } catch (error) {
    console.error("Error fetching workout types:", error);
    return sendError(res, "Failed to retrieve workout types.", error.message, 500);
  }
};

/**
 * POST /workout/start
 * Start a new workout session (Enforces 1 active workout per user constraint).
 */
const startWorkout = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return sendError(res, "User ID missing from authentication token.", null, 401);
    }

    // Single Active Workout Guard: Check if user already has a workout in progress
    const existingActive = await getActiveWorkoutByUserId(userId);
    if (existingActive) {
      return sendError(
        res,
        `You already have an active "${existingActive.workout_type_name}" workout session in progress. Complete or discard it before starting another one.`,
        existingActive,
        409 // 409 Conflict
      );
    }

    const workoutTypeId = req.body.workoutTypeId || req.body.workout_type_id;
    const { status, startTime } = req.body;

    if (!workoutTypeId) {
      return sendError(
        res,
        "workoutTypeId is required.",
        null,
        400,
      );
    }

    const workoutType = await getWorkoutTypeById(workoutTypeId);
    if (!workoutType) {
      return sendError(
        res,
        `Workout type with ID ${workoutTypeId} not found.`,
        null,
        404,
      );
    }

    const workoutSession = await createWorkout({
      userId,
      workoutTypeId,
      status: status || "in_progress",
      startTime: startTime || null,
    });

    return sendSuccess(res, "Workout session started successfully.", workoutSession, 201);
  } catch (error) {
    console.error("Error starting workout session:", error);
    return sendError(res, "Failed to start workout session.", error.message, 500);
  }
};

/**
 * GET /workout/active
 * Fetch user's currently active workout session (if any).
 */
const fetchActiveWorkout = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return sendError(res, "User ID missing from authentication token.", null, 401);
    }

    const activeWorkout = await getActiveWorkoutByUserId(userId);
    if (!activeWorkout) {
      return sendSuccess(res, "No active workout session found.", null, 200);
    }

    return sendSuccess(res, "Active workout session retrieved successfully.", activeWorkout, 200);
  } catch (error) {
    console.error("Error fetching active workout:", error);
    return sendError(res, "Failed to retrieve active workout.", error.message, 500);
  }
};

/**
 * POST /workout/location
 * Save live GPS coordinates batch.
 */
const saveLocations = async (req, res) => {
  try {
    const workoutId = req.body.workoutId || req.body.workout_id;
    const locations = req.body.locations;
    if (!workoutId || !locations) {
      return sendError(res, "workoutId and locations array are required.", null, 400);
    }
    await saveWorkoutLocations(workoutId, locations);
    return sendSuccess(res, "GPS locations recorded successfully.", null, 200);
  } catch (error) {
    console.error("Error saving location batch:", error);
    return sendError(res, "Failed to save location data.", error.message, 500);
  }
};

/**
 * GET /workout/locations/:workoutId
 * Fetch GPS route locations for a workout.
 */
const fetchWorkoutLocations = async (req, res) => {
  try {
    const workoutId = req.params.workoutId;
    if (!workoutId) {
      return sendError(res, "workoutId path parameter is required.", null, 400);
    }
    const locations = await getLocationsByWorkoutId(workoutId);
    return sendSuccess(res, "Workout location points retrieved successfully.", locations, 200);
  } catch (error) {
    console.error("Error fetching workout locations:", error);
    return sendError(res, "Failed to retrieve workout location points.", error.message, 500);
  }
};

/**
 * POST /workout/stop
 * Complete/Finish a workout session.
 */
const stopWorkout = async (req, res) => {
  try {
    const workoutId = req.body.workoutId || req.body.workout_id;
    if (!workoutId) {
      return sendError(res, "workoutId is required.", null, 400);
    }
    const completedWorkout = await finishWorkout(workoutId, req.body);
    if (!completedWorkout) {
      return sendError(
        res,
        `Workout session with ID ${workoutId} not found.`,
        null,
        404,
      );
    }
    return sendSuccess(res, "Workout session status updated successfully.", completedWorkout, 200);
  } catch (error) {
    console.error("Error finishing workout session:", error);
    return sendError(res, "Failed to complete workout session.", error.message, 500);
  }
};

/**
 * GET /workout/history
 * Fetch user's completed workout history log.
 */
const fetchWorkoutHistory = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return sendError(res, "User ID missing from authentication token.", null, 401);
    }

    const history = await getWorkoutHistoryByUserId(userId);
    return sendSuccess(res, "Workout history retrieved successfully.", history, 200);
  } catch (error) {
    console.error("Error fetching workout history:", error);
    return sendError(res, "Failed to retrieve workout history.", error.message, 500);
  }
};

/**
 * Normalizes input status strings into standard database values.
 * e.g., 'inprosses' -> 'in_progress', 'comlited' -> 'completed'
 */
const normalizeWorkoutStatus = (inputStatus) => {
  if (!inputStatus || typeof inputStatus !== "string") return null;
  const s = inputStatus.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (["in_progress", "inprogress", "inprosses", "in_process", "inprocess"].includes(s)) {
    return "in_progress";
  }
  if (["completed", "complete", "comlited", "done", "finished"].includes(s)) {
    return "completed";
  }
  if (["paused", "pause"].includes(s)) {
    return "paused";
  }
  if (["cancelled", "canceled", "cancel"].includes(s)) {
    return "cancelled";
  }
  return s;
};

/**
 * PUT /workout/status, /workout/status/:workoutId, /workout/:workoutId/status
 * Update workout status (e.g. from in_progress to completed, paused, cancelled).
 */
const updateWorkoutStatusController = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return sendError(res, "User ID missing from authentication token.", null, 401);
    }

    let workoutId =
      req.params.workoutId ||
      req.params.id ||
      req.body.workoutId ||
      req.body.workout_id ||
      req.body.id;

    // If workoutId wasn't explicitly supplied, default to user's currently active workout session
    if (!workoutId) {
      const activeWorkout = await getActiveWorkoutByUserId(userId);
      if (activeWorkout) {
        workoutId = activeWorkout.id;
      } else {
        return sendError(
          res,
          "workoutId is required or an active workout session must exist.",
          null,
          400
        );
      }
    }

    const parsedWorkoutId = parseInt(workoutId, 10);
    if (isNaN(parsedWorkoutId)) {
      return sendError(res, "Invalid workoutId. Must be a valid integer.", null, 400);
    }

    const rawStatus = req.body.status || req.query.status;
    if (!rawStatus) {
      return sendError(
        res,
        "status is required (e.g., 'in_progress', 'completed', 'paused', 'cancelled').",
        null,
        400
      );
    }

    const normalizedStatus = normalizeWorkoutStatus(rawStatus);

    // Verify workout exists
    const workout = await getWorkoutById(parsedWorkoutId);
    if (!workout) {
      return sendError(
        res,
        `Workout session with ID ${parsedWorkoutId} not found.`,
        null,
        404
      );
    }

    // Verify user ownership
    if (workout.user_id !== userId) {
      return sendError(
        res,
        "You are not authorized to update this workout session.",
        null,
        403
      );
    }

    // If attempting to switch status back to 'in_progress', verify user doesn't already have another active workout
    if (normalizedStatus === "in_progress" && workout.status !== "in_progress") {
      const existingActive = await getActiveWorkoutByUserId(userId);
      if (existingActive && existingActive.id !== parsedWorkoutId) {
        return sendError(
          res,
          `You already have an active "${existingActive.workout_type_name}" workout session in progress (ID: ${existingActive.id}). Complete or cancel it first.`,
          existingActive,
          409
        );
      }
    }

    const updatedWorkout = await updateWorkoutStatus(parsedWorkoutId, {
      ...req.body,
      status: normalizedStatus,
    });

    return sendSuccess(
      res,
      `Workout status updated to '${normalizedStatus}' successfully.`,
      updatedWorkout,
      200
    );
  } catch (error) {
    console.error("Error updating workout status:", error);
    return sendError(res, "Failed to update workout status.", error.message, 500);
  }
};

/**
 * DELETE /workout/locations/cleanup
 * Manually delete all workout_locations records.
 */
const cleanLocations = async (req, res) => {
  try {
    const deletedRows = await clearWorkoutLocations();
    return sendSuccess(
      res,
      `Successfully deleted ${deletedRows} records from workout_locations.`,
      { deletedCount: deletedRows },
      200,
    );
  } catch (error) {
    console.error("Error cleaning location data:", error);
    return sendError(res, "Failed to clean workout_locations table.", error.message, 500);
  }
};

module.exports = {
  fetchWorkoutTypes,
  startWorkout,
  fetchActiveWorkout,
  saveLocations,
  fetchWorkoutLocations,
  stopWorkout,
  updateWorkoutStatusController,
  updateWorkoutStatus: updateWorkoutStatusController,
  fetchWorkoutHistory,
  cleanLocations,
};
