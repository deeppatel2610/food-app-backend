const envVariables = require("../utils/envVariables");

const dbConfig = {
  user: envVariables.DB_USER,
  host: envVariables.DB_HOST,
  database: envVariables.DB_NAME,
  password: envVariables.DB_PASSWORD,
  port: envVariables.DB_PORT,
};

module.exports = dbConfig;
