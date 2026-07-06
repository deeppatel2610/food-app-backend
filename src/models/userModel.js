const pool = require("../config/dbInit");

/**
 * Creates the `users` table in PostgreSQL database if it does not exist.
 */
const createUserTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      age INT,
      weight DECIMAL(5,2),
      height DECIMAL(5,2),
      bmi DECIMAL(5,2),
      blood_group VARCHAR(10),
      health_problem TEXT,
      refresh_token TEXT,
      is_online BOOLEAN DEFAULT FALSE,
      is_delete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(queryText);
    console.log("Users table verified / created successfully.");
  } catch (error) {
    console.error("Error creating users table:", error);
  }
};

/**
 * Find user by email or username
 */
const findUserByEmailOrUsername = async (email, username) => {
  const query = `
    SELECT * FROM users 
    WHERE (email = $1 OR username = $2) AND is_delete = FALSE
  `;
  const result = await pool.query(query, [email, username]);
  return result.rows[0];
};

/**
 * Find user by ID
 */
const findUserById = async (id) => {
  const query = `SELECT * FROM users WHERE id = $1 AND is_delete = FALSE`;
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

/**
 * Create a new user
 */
const createUser = async (userData) => {
  const {
    first_name,
    last_name,
    username,
    email,
    password,
    age,
    weight,
    height,
    bmi,
    blood_group,
    health_problem,
  } = userData;

  const query = `
    INSERT INTO users (
      first_name, last_name, username, email, password,
      age, weight, height, bmi, blood_group, health_problem
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, first_name, last_name, username, email, age, weight, height, bmi, blood_group, health_problem, is_online, created_at;
  `;

  const values = [
    first_name || null,
    last_name || null,
    username,
    email,
    password,
    age || null,
    weight || null,
    height || null,
    bmi || null,
    blood_group || null,
    health_problem || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Update user login status & refresh token
 */
const updateUserLoginStatus = async (userId, refreshToken, isOnline) => {
  const query = `
    UPDATE users 
    SET refresh_token = $1, is_online = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, username, email, is_online;
  `;
  const result = await pool.query(query, [refreshToken, isOnline, userId]);
  return result.rows[0];
};

/**
 * Update user profile
 */
const updateUser = async (id, updateData) => {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(updateData)) {
    fields.push(`${key} = $${index}`);
    values.push(value);
    index++;
  }

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE users 
    SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${index} AND is_delete = FALSE
    RETURNING id, first_name, last_name, username, email, age, weight, height, bmi, blood_group, health_problem, is_online, created_at, updated_at;
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Update user password and clear refresh token
 */
const updateUserPassword = async (userId, hashedPassword) => {
  const query = `
    UPDATE users 
    SET password = $1, refresh_token = null, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND is_delete = FALSE
    RETURNING id, username, email;
  `;
  const result = await pool.query(query, [hashedPassword, userId]);
  return result.rows[0];
};

module.exports = {
  createUserTable,
  findUserByEmailOrUsername,
  findUserById,
  createUser,
  updateUserLoginStatus,
  updateUser,
  updateUserPassword,
};
