require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const JWT = process.env.JWT;

// Fail fast in production if JWT secret is not properly configured
if (NODE_ENV === "production" && (!JWT || JWT === "your_super_secure_jwt_secret_key_here")) {
  throw new Error("CRITICAL CONFIG ERROR: process.env.JWT is not set or using default value in production!");
}

module.exports = {
  NODE_ENV,
  JWT,
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_PORT: process.env.DB_PORT,
  PORT: process.env.PORT || 3000,
  HOST: process.env.IP || "[IP_ADDRESS]",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3000",
  SMTP_HOST: process.env.SMTP_HOST || "smtp.mailtrap.io",
  SMTP_PORT: process.env.SMTP_PORT || 2525,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM || "noreply@foodapp.com",
};
