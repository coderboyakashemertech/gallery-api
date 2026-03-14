const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const toBoolean = (value) => String(value).toLowerCase() === "true";
const toList = (value, fallback = ["*"]) => {
  if (!value) {
    return fallback;
  }

  const values = String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
};

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  authEnabled: toBoolean(process.env.AUTH_ENABLED),
  corsAllowedOrigins: toList(process.env.CORS_ALLOWED_ORIGINS),
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h"
};
