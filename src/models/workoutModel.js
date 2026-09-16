const pool = require("../config/dbInit");

/**
 * Creates workout database tables (workout_types, workouts, workout_locations) if they do not exist
 * and seeds initial default workout types.
 */
const createWorkoutTables = async () => {
  const createTypesTable = `
    CREATE TABLE IF NOT EXISTS workout_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      category VARCHAR(100) NOT NULL,
      icon_url VARCHAR(255),
      is_gps_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createWorkoutsTable = `
    CREATE TABLE IF NOT EXISTS workouts (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      workout_type_id INT REFERENCES workout_types(id) ON DELETE CASCADE,
      status VARCHAR(50) DEFAULT 'in_progress',
      start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP WITH TIME ZONE,
      duration_seconds INT DEFAULT 0,
      distance_meters DECIMAL(10, 2) DEFAULT 0,
      calories_burned DECIMAL(10, 2) DEFAULT 0,
      elevation_gain_meters DECIMAL(10, 2) DEFAULT 0,
      average_speed_mps DECIMAL(10, 2) DEFAULT 0,
      average_pace_sec_per_km INT DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createLocationsTable = `
    CREATE TABLE IF NOT EXISTS workout_locations (
      id SERIAL PRIMARY KEY,
      workout_id INT REFERENCES workouts(id) ON DELETE CASCADE,
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      altitude DECIMAL(8, 2),
      speed DECIMAL(6, 2) DEFAULT 0,
      accuracy DECIMAL(6, 2),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
    CREATE INDEX IF NOT EXISTS idx_workouts_status ON workouts(status);
    CREATE INDEX IF NOT EXISTS idx_workout_locations_workout_id ON workout_locations(workout_id);
  `;

  try {
    await pool.query(createTypesTable);
    await pool.query(createWorkoutsTable);
    await pool.query(createLocationsTable);
    await pool.query(createIndexes);

    // Seed default workout types if table is empty
    const checkCount = await pool.query("SELECT COUNT(*) FROM workout_types;");
    if (parseInt(checkCount.rows[0].count, 10) === 0) {
      const seedTypes = `
        INSERT INTO workout_types (name, category, icon_url, is_gps_enabled) VALUES
        ('Running', 'Cardio', '/uploads/icons/running.png', true),
        ('Cycling', 'Cardio', '/uploads/icons/cycling.png', true),
        ('Walking', 'Cardio', '/uploads/icons/walking.png', true),
        ('Gym', 'Strength', '/uploads/icons/gym.png', false),
        ('Yoga', 'Flexibility', '/uploads/icons/yoga.png', false),
        ('Treadmill', 'Cardio', '/uploads/icons/treadmill.png', false),
        ('Swimming', 'Cardio', '/uploads/icons/swimming.png', false),
        ('Hiking', 'Outdoor', '/uploads/icons/hiking.png', true),
        ('Jump Rope', 'Cardio', '/uploads/icons/jump_rope.png', false),
        ('Strength Training', 'Strength', '/uploads/icons/strength_training.png', false),
        ('HIIT', 'Cardio', '/uploads/icons/hiit.png', false),
        ('Rowing', 'Cardio', '/uploads/icons/rowing.png', false),
        ('Elliptical', 'Cardio', '/uploads/icons/elliptical.png', false),
        ('Stair Climbing', 'Cardio', '/uploads/icons/stair_climbing.png', false),
        ('Custom Workout', 'Other', '/uploads/icons/custom_workout.png', false);
      `;
      await pool.query(seedTypes);
      console.log("Pre-seeded default workout types into PostgreSQL.");
    }
    console.log("Workout tables verified / created successfully.");
  } catch (error) {
    console.error("Error creating workout tables:", error);
  }
};

/**
 * Fetch all workout types ordered by ID.
 */
const getWorkoutTypes = async () => {
  const query = `
    SELECT id, name, category, icon_url, is_gps_enabled, created_at 
    FROM workout_types 
    ORDER BY id;
  `;
  const result = await pool.query(query);
  return result.rows;
};

/**
 * Fetch a single workout type by ID.
 */
const getWorkoutTypeById = async (id) => {
  const query = `
    SELECT id, name, category, icon_url, is_gps_enabled 
    FROM workout_types 
    WHERE id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

/**
 * Fetch a single workout session by its ID.
 */
const getWorkoutById = async (workoutId) => {
  const query = `
    SELECT 
      w.*,
      wt.name AS workout_type_name,
      wt.category AS workout_type_category,
      wt.icon_url AS workout_type_icon_url,
      wt.is_gps_enabled
    FROM workouts w
    JOIN workout_types wt ON w.workout_type_id = wt.id
    WHERE w.id = $1;
  `;
  const result = await pool.query(query, [workoutId]);
  return result.rows[0];
};

/**
 * Create/Start a new active workout session.
 */
const createWorkout = async ({ userId, workoutTypeId, status = "in_progress", startTime }) => {
  const query = `
    WITH inserted AS (
      INSERT INTO workouts (user_id, workout_type_id, status, start_time)
      VALUES ($1, $2, $3, COALESCE($4, NOW()))
      RETURNING *
    )
    SELECT 
      w.id,
      w.user_id,
      w.workout_type_id,
      w.status,
      w.start_time,
      w.created_at,
      wt.name AS workout_type_name,
      wt.category AS workout_type_category,
      wt.icon_url AS workout_type_icon_url,
      wt.is_gps_enabled
    FROM inserted w
    JOIN workout_types wt ON w.workout_type_id = wt.id;
  `;
  const values = [userId, workoutTypeId, status, startTime || null];
  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Save batch of live GPS location coordinates for a workout.
 */
const saveWorkoutLocations = async (workoutId, locations) => {
  if (!locations || !Array.isArray(locations) || locations.length === 0) {
    return true;
  }
  const values = [];
  const valueStrings = locations.map((loc, idx) => {
    const base = idx * 7;
    values.push(
      workoutId,
      loc.latitude ?? loc.lat,
      loc.longitude ?? loc.lng,
      loc.altitude ?? null,
      loc.speed ?? 0,
      loc.accuracy ?? null,
      loc.timestamp || new Date()
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  }).join(", ");
  const query = `
    INSERT INTO workout_locations (workout_id, latitude, longitude, altitude, speed, accuracy, timestamp)
    VALUES ${valueStrings};
  `;
  await pool.query(query, values);
  return true;
};

/**
 * Fetch recorded GPS location points for a workout.
 */
const getLocationsByWorkoutId = async (workoutId) => {
  const query = `
    SELECT id, workout_id, latitude, longitude, altitude, speed, accuracy, timestamp
    FROM workout_locations
    WHERE workout_id = $1
    ORDER BY timestamp ASC;
  `;
  const result = await pool.query(query, [workoutId]);
  return result.rows;
};

/**
 * Finish or Cancel a workout session with final metrics.
 */
const finishWorkout = async (workoutId, finishData = {}) => {
  const {
    status = finishData.status || "completed",
    endTime = finishData.endTime || finishData.end_time || null,
    durationSeconds = finishData.durationSeconds || finishData.duration_seconds || 0,
    distanceMeters = finishData.distanceMeters || finishData.distance_meters || 0,
    caloriesBurned = finishData.caloriesBurned || finishData.calories_burned || 0,
    elevationGainMeters = finishData.elevationGainMeters || finishData.elevation_gain_meters || 0,
    averageSpeedMps = finishData.averageSpeedMps || finishData.average_speed_mps || 0,
    averagePaceSecPerKm = finishData.averagePaceSecPerKm || finishData.average_pace_sec_per_km || 0,
    notes = finishData.notes || null,
  } = finishData;

  const query = `
    WITH updated AS (
      UPDATE workouts
      SET status = $2,
          end_time = COALESCE($3, NOW()),
          duration_seconds = COALESCE($4, duration_seconds),
          distance_meters = COALESCE($5, distance_meters),
          calories_burned = COALESCE($6, calories_burned),
          elevation_gain_meters = COALESCE($7, elevation_gain_meters),
          average_speed_mps = COALESCE($8, average_speed_mps),
          average_pace_sec_per_km = COALESCE($9, average_pace_sec_per_km),
          notes = COALESCE($10, notes)
      WHERE id = $1
      RETURNING *
    )
    SELECT 
      w.*,
      wt.name AS workout_type_name,
      wt.category AS workout_type_category,
      wt.icon_url AS workout_type_icon_url,
      wt.is_gps_enabled
    FROM updated w
    JOIN workout_types wt ON w.workout_type_id = wt.id;
  `;
  const values = [
    workoutId,
    status || "completed",
    endTime || null,
    durationSeconds || 0,
    distanceMeters || 0,
    caloriesBurned || 0,
    elevationGainMeters || 0,
    averageSpeedMps || 0,
    averagePaceSecPerKm || 0,
    notes || null,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Update the status and optional metrics of a workout session (e.g., in_progress, completed, paused, cancelled).
 */
const updateWorkoutStatus = async (workoutId, updateData = {}) => {
  const {
    status,
    endTime = updateData.endTime || updateData.end_time || null,
    durationSeconds = updateData.durationSeconds ?? updateData.duration_seconds,
    distanceMeters = updateData.distanceMeters ?? updateData.distance_meters,
    caloriesBurned = updateData.caloriesBurned ?? updateData.calories_burned,
    elevationGainMeters = updateData.elevationGainMeters ?? updateData.elevation_gain_meters,
    averageSpeedMps = updateData.averageSpeedMps ?? updateData.average_speed_mps,
    averagePaceSecPerKm = updateData.averagePaceSecPerKm ?? updateData.average_pace_sec_per_km,
    notes = updateData.notes,
  } = updateData;

  const query = `
    WITH updated AS (
      UPDATE workouts
      SET status = COALESCE($2, status),
          end_time = CASE 
            WHEN $3::timestamptz IS NOT NULL THEN $3::timestamptz
            WHEN $2 = 'completed' AND end_time IS NULL THEN NOW()
            WHEN $2 = 'in_progress' THEN NULL
            ELSE end_time
          END,
          duration_seconds = COALESCE($4, duration_seconds),
          distance_meters = COALESCE($5, distance_meters),
          calories_burned = COALESCE($6, calories_burned),
          elevation_gain_meters = COALESCE($7, elevation_gain_meters),
          average_speed_mps = COALESCE($8, average_speed_mps),
          average_pace_sec_per_km = COALESCE($9, average_pace_sec_per_km),
          notes = COALESCE($10, notes)
      WHERE id = $1
      RETURNING *
    )
    SELECT 
      w.*,
      wt.name AS workout_type_name,
      wt.category AS workout_type_category,
      wt.icon_url AS workout_type_icon_url,
      wt.is_gps_enabled
    FROM updated w
    JOIN workout_types wt ON w.workout_type_id = wt.id;
  `;

  const values = [
    workoutId,
    status || null,
    endTime || null,
    durationSeconds !== undefined ? durationSeconds : null,
    distanceMeters !== undefined ? distanceMeters : null,
    caloriesBurned !== undefined ? caloriesBurned : null,
    elevationGainMeters !== undefined ? elevationGainMeters : null,
    averageSpeedMps !== undefined ? averageSpeedMps : null,
    averagePaceSecPerKm !== undefined ? averagePaceSecPerKm : null,
    notes !== undefined ? notes : null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Retrieve workout history log for a user.
 */
const getWorkoutHistoryByUserId = async (userId) => {
  const query = `
    SELECT 
      w.id,
      w.user_id,
      w.workout_type_id,
      w.status,
      w.start_time,
      w.end_time,
      w.duration_seconds,
      w.distance_meters,
      w.calories_burned,
      w.elevation_gain_meters,
      w.average_speed_mps,
      w.average_pace_sec_per_km,
      w.notes,
      w.created_at,
      wt.name AS workout_type_name,
      wt.category AS workout_type_category,
      wt.icon_url AS workout_type_icon_url,
      wt.is_gps_enabled
    FROM workouts w
    JOIN workout_types wt ON w.workout_type_id = wt.id
    WHERE w.user_id = $1
    ORDER BY w.created_at DESC;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

/**
 * Retrieve active workout session for a user (if any).
 */
const getActiveWorkoutByUserId = async (userId) => {
  const query = `
    SELECT 
      w.id,
      w.user_id,
      w.workout_type_id,
      w.status,
      w.start_time,
      w.created_at,
      wt.name AS workout_type_name,
      wt.category AS workout_type_category,
      wt.icon_url AS workout_type_icon_url,
      wt.is_gps_enabled
    FROM workouts w
    JOIN workout_types wt ON w.workout_type_id = wt.id
    WHERE w.user_id = $1 AND w.status = 'in_progress'
    LIMIT 1;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows[0];
};

/**
 * Delete all records from workout_locations table.
 */
const clearWorkoutLocations = async () => {
  const query = `DELETE FROM workout_locations;`;
  const result = await pool.query(query);
  return result.rowCount;
};

module.exports = {
  createWorkoutTables,
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
};
