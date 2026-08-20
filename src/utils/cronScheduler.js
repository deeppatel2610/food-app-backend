const cron = require("node-cron");
const { clearWorkoutLocations } = require("../models/workoutModel");

/**
 * Initialize scheduled background cron tasks.
 * Schedules cleanup to run automatically on the 1st day of every month at 12:00 AM (Midnight, 00:00).
 */
const initScheduledTasks = () => {
  // Cron schedule: '0 0 1 * *' = At 00:00 (12:00 AM Midnight) on the 1st day of every month
  cron.schedule("0 0 1 * *", async () => {
    console.log("[CRON] Running monthly midnight (12:00 AM, 1st of month) cleanup for workout_locations...");
    try {
      const deletedCount = await clearWorkoutLocations();
      console.log(`[CRON SUCCESS] Automatically deleted ${deletedCount} location records from workout_locations for monthly cleanup.`);
    } catch (error) {
      console.error("[CRON ERROR] Failed to clean workout_locations table:", error);
    }
  });

  console.log("Monthly Midnight (12:00 AM, 1st of month) Cleanup Cron Job Initialized.");
};

module.exports = {
  initScheduledTasks,
};
