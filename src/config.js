const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const toBoolean = (value) => String(value).toLowerCase() === "true";

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  authEnabled: toBoolean(process.env.AUTH_ENABLED),
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h"
};
