require("dotenv").config();

module.exports = {
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_PORT: process.env.DB_PORT,
  PORT: process.env.PORT || 3000,
  HOST: process.env.IP || "[IP_ADDRESS]",
  JWT: process.env.JWT,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};
