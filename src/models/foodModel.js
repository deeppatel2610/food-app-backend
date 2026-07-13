const pool = require("../config/dbInit");

/**
 * Creates the `food_analyses` table in PostgreSQL database if it does not exist.
 */
const createFoodAnalysisTable = async () => {
  const createQuery = `
    CREATE TABLE IF NOT EXISTS food_analyses (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      is_food BOOLEAN,
      food_name VARCHAR(255),
      brand VARCHAR(255),
      is_packaged BOOLEAN,
      ingredients JSONB,
      oil_used VARCHAR(255),
      nutrition JSONB,
      verdict JSONB,
      is_eat BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const alterQuery = `
    ALTER TABLE food_analyses ADD COLUMN IF NOT EXISTS is_eat BOOLEAN DEFAULT FALSE;
  `;
  const indexQuery = `
    CREATE INDEX IF NOT EXISTS idx_food_analyses_user_id ON food_analyses(user_id);
  `;
  try {
    await pool.query(createQuery);
    await pool.query(alterQuery);
    await pool.query(indexQuery);
    console.log("Food analyses table verified / created successfully.");
  } catch (error) {
    console.error("Error creating/altering food_analyses table:", error);
  }
};

/**
 * Save a new food analysis record
 */
const saveFoodAnalysis = async (userId, analysisData, isEat = false) => {
  const query = `
    INSERT INTO food_analyses (
      user_id, is_food, food_name, brand, is_packaged,
      ingredients, oil_used, nutrition, verdict, is_eat
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;
  const values = [
    userId,
    analysisData.is_food,
    analysisData.food_name || null,
    analysisData.brand || null,
    analysisData.is_packaged ?? null,
    analysisData.ingredients ? JSON.stringify(analysisData.ingredients) : null,
    analysisData.oil_used || null,
    analysisData.nutrition ? JSON.stringify(analysisData.nutrition) : null,
    analysisData.verdict ? JSON.stringify(analysisData.verdict) : null,
    isEat
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Get food analysis history for a specific user where is_eat is TRUE
 */
const getFoodAnalysisHistoryByUserId = async (userId, filters = {}) => {
  let query = `
    SELECT * FROM food_analyses 
    WHERE user_id = $1
  `;
  const values = [userId];
  let paramIndex = 2;

  if (filters.isEat !== undefined && filters.isEat !== 'all' && filters.isEat !== '') {
    const isEatBool = filters.isEat === true || filters.isEat === 'true';
    query += ` AND is_eat = $${paramIndex}`;
    values.push(isEatBool);
    paramIndex++;
  }

  if (filters.date) {
    query += ` AND (created_at AT TIME ZONE 'UTC')::date = $${paramIndex}`;
    values.push(filters.date);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC;`;

  const result = await pool.query(query, values);
  return result.rows;
};

/**
 * Update the is_eat status of a food analysis record
 */
const updateFoodAnalysisIsEat = async (id, userId, isEat) => {
  const query = `
    UPDATE food_analyses 
    SET is_eat = $1 
    WHERE id = $2 AND user_id = $3 
    RETURNING *;
  `;
  const result = await pool.query(query, [isEat, id, userId]);
  return result.rows[0];
};

/**
 * Get a specific food analysis record by ID and user ID
 */
const getFoodAnalysisById = async (id, userId) => {
  const query = `
    SELECT * FROM food_analyses 
    WHERE id = $1 AND user_id = $2;
  `;
  const result = await pool.query(query, [id, userId]);
  return result.rows[0];
};

module.exports = {
  createFoodAnalysisTable,
  saveFoodAnalysis,
  getFoodAnalysisHistoryByUserId,
  updateFoodAnalysisIsEat,
  getFoodAnalysisById,
};
