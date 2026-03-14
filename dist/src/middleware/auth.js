const { verifyAccessToken } = require("../services/tokenService");
const { sendError } = require("../utils/response");

function readBearerToken(req) {
  const authHeader = req.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

function unauthorizedResponse(res, message) {
  const error = new Error(message);
  error.status = 401;
  error.code = "AUTHENTICATION_REQUIRED";
  return sendError(res, error, "Authentication required.");
}

function attachUserFromToken(req, token, next, res) {
  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return unauthorizedResponse(res, "Bearer token is invalid or expired.");
  }
}

function createAuthMiddleware({ authEnabled }) {
  if (!authEnabled) {
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    const token = readBearerToken(req);

    if (!token) {
      return unauthorizedResponse(
        res,
        "Set AUTH_ENABLED=false to bypass auth or provide a valid JWT bearer token."
      );
    }

    return attachUserFromToken(req, token, next, res);
  };
}

function requireJwt(req, res, next) {
  const token = readBearerToken(req);

  if (!token) {
    return unauthorizedResponse(res, "Provide a valid JWT bearer token.");
  }

  return attachUserFromToken(req, token, next, res);
}

module.exports = {
  createAuthMiddleware,
  requireJwt
};
