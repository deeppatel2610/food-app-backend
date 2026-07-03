const { Pool } = require("pg");
const dbConfig = require("./dbConfig");

const pool = new Pool(dbConfig);

module.exports = pool;
