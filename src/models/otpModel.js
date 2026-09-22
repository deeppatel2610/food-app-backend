const pool = require("../config/dbInit");

/**
 * Creates the `otp_verifications` table in PostgreSQL database if it does not exist.
 */
const createOtpTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      otp_code VARCHAR(10) NOT NULL,
      user_data JSONB NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON otp_verifications(email);
  `;
  try {
    await pool.query(queryText);
    console.log("OTP verifications table verified / created successfully.");
  } catch (error) {
    console.error("Error creating otp_verifications table:", error);
  }
};

/**
 * Upsert pending OTP verification record for an email.
 * Overwrites with new OTP code and data if an unverified entry already exists.
 */
const saveOtpVerification = async (email, otpCode, userData, expiresInMinutes = 10) => {
  const query = `
    INSERT INTO otp_verifications (email, otp_code, user_data, expires_at, created_at)
    VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::INTERVAL, NOW())
    ON CONFLICT (email)
    DO UPDATE SET
      otp_code = EXCLUDED.otp_code,
      user_data = EXCLUDED.user_data,
      expires_at = EXCLUDED.expires_at,
      created_at = NOW()
    RETURNING id, email, otp_code, expires_at, created_at;
  `;
  const values = [email.toLowerCase().trim(), otpCode, JSON.stringify(userData), expiresInMinutes];
  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Find pending OTP verification record by email.
 */
const findOtpByEmail = async (email) => {
  const query = `
    SELECT * FROM otp_verifications 
    WHERE LOWER(email) = LOWER($1);
  `;
  const result = await pool.query(query, [email.trim()]);
  return result.rows[0];
};

/**
 * Update existing OTP verification with a new code and fresh expiration.
 */
const updateOtpCode = async (email, newOtpCode, expiresInMinutes = 10) => {
  const query = `
    UPDATE otp_verifications
    SET otp_code = $2,
        expires_at = NOW() + ($3 || ' minutes')::INTERVAL,
        created_at = NOW()
    WHERE LOWER(email) = LOWER($1)
    RETURNING id, email, otp_code, user_data, expires_at;
  `;
  const values = [email.toLowerCase().trim(), newOtpCode, expiresInMinutes];
  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Delete pending OTP record after successful registration.
 */
const deleteOtpByEmail = async (email) => {
  const query = `DELETE FROM otp_verifications WHERE LOWER(email) = LOWER($1);`;
  const result = await pool.query(query, [email.trim()]);
  return result.rowCount;
};

/**
 * Creates the `user_update_otps` table in PostgreSQL database if it does not exist.
 */
const createUserUpdateOtpTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS user_update_otps (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      otp_code VARCHAR(10) NOT NULL,
      update_data JSONB NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_user_update_otp UNIQUE (user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_update_otps_user_id ON user_update_otps(user_id);
  `;
  try {
    await pool.query(queryText);

    // Apply migrations for dual OTP email verification
    try {
      await pool.query("ALTER TABLE user_update_otps ADD COLUMN IF NOT EXISTS old_email VARCHAR(255);");
      await pool.query("ALTER TABLE user_update_otps ADD COLUMN IF NOT EXISTS new_email VARCHAR(255);");
      await pool.query("ALTER TABLE user_update_otps ADD COLUMN IF NOT EXISTS old_email_otp VARCHAR(10);");
      await pool.query("ALTER TABLE user_update_otps ADD COLUMN IF NOT EXISTS new_email_otp VARCHAR(10);");
      await pool.query("ALTER TABLE user_update_otps ADD COLUMN IF NOT EXISTS is_email_change BOOLEAN DEFAULT FALSE;");
    } catch (migErr) {
      console.warn("user_update_otps column migration notice:", migErr.message);
    }

    console.log("User update OTPs table verified / created successfully.");
  } catch (error) {
    console.error("Error creating user_update_otps table:", error);
  }
};

/**
 * Upsert pending profile update data and OTP for an authenticated user.
 * Supports both single OTP (profile fields only) and dual OTP (when email changes).
 */
const saveUserUpdateOtp = async ({
  userId,
  email,
  otpCode = "",
  updateData,
  isEmailChange = false,
  oldEmail = null,
  newEmail = null,
  oldEmailOtp = null,
  newEmailOtp = null,
  expiresInMinutes = 10,
}) => {
  const query = `
    INSERT INTO user_update_otps (
      user_id, email, otp_code, update_data, is_email_change,
      old_email, new_email, old_email_otp, new_email_otp, expires_at, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + ($10 || ' minutes')::INTERVAL, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      otp_code = EXCLUDED.otp_code,
      update_data = EXCLUDED.update_data,
      is_email_change = EXCLUDED.is_email_change,
      old_email = EXCLUDED.old_email,
      new_email = EXCLUDED.new_email,
      old_email_otp = EXCLUDED.old_email_otp,
      new_email_otp = EXCLUDED.new_email_otp,
      expires_at = EXCLUDED.expires_at,
      created_at = NOW()
    RETURNING id, user_id, email, otp_code, is_email_change, old_email, new_email, old_email_otp, new_email_otp, update_data, expires_at, created_at;
  `;
  const values = [
    userId,
    email.toLowerCase().trim(),
    otpCode || oldEmailOtp || "",
    JSON.stringify(updateData),
    isEmailChange,
    oldEmail ? oldEmail.toLowerCase().trim() : null,
    newEmail ? newEmail.toLowerCase().trim() : null,
    oldEmailOtp,
    newEmailOtp,
    expiresInMinutes,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Find pending profile update OTP record by user ID.
 */
const findUserUpdateOtp = async (userId) => {
  const query = `SELECT * FROM user_update_otps WHERE user_id = $1;`;
  const result = await pool.query(query, [userId]);
  return result.rows[0];
};

/**
 * Delete pending profile update OTP record for a user.
 */
const deleteUserUpdateOtp = async (userId) => {
  const query = `DELETE FROM user_update_otps WHERE user_id = $1;`;
  const result = await pool.query(query, [userId]);
  return result.rowCount;
};

/**
 * Clean up expired OTP verification records.
 */
const cleanupExpiredOtps = async () => {
  const query = `DELETE FROM otp_verifications WHERE expires_at < NOW();`;
  const result = await pool.query(query);
  return result.rowCount;
};


module.exports = {
  createOtpTable,
  createUserUpdateOtpTable,
  saveOtpVerification,
  findOtpByEmail,
  updateOtpCode,
  deleteOtpByEmail,
  cleanupExpiredOtps,
  saveUserUpdateOtp,
  findUserUpdateOtp,
  deleteUserUpdateOtp,
};

