const DEFAULT_ALLOWED_HEADERS = "Authorization, Content-Type";
const DEFAULT_ALLOWED_METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";

function allowsAllOrigins(allowedOrigins) {
  return allowedOrigins.includes("*");
}

function isOriginAllowed(origin, allowedOrigins) {
  return allowsAllOrigins(allowedOrigins) || allowedOrigins.includes(origin);
}

function applyCorsHeaders(req, res, allowedOrigins) {
  const origin = req.get("origin");
  const requestedHeaders = req.get("access-control-request-headers");
  const allowAllOrigins = allowsAllOrigins(allowedOrigins);

  if (!origin) {
    res.set("Access-Control-Allow-Origin", "*");
  } else if (allowAllOrigins) {
    res.set("Access-Control-Allow-Origin", "*");
  } else {
    res.set("Access-Control-Allow-Origin", origin);
    res.append("Vary", "Origin");
  }

  if (requestedHeaders) {
    res.set("Access-Control-Allow-Headers", requestedHeaders);
    res.append("Vary", "Access-Control-Request-Headers");
  } else {
    res.set("Access-Control-Allow-Headers", DEFAULT_ALLOWED_HEADERS);
  }

  res.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS);
  res.set("Access-Control-Max-Age", "86400");
}

function createCorsMiddleware({ allowedOrigins = ["*"] } = {}) {
  return (req, res, next) => {
    const origin = req.get("origin");

    if (origin && !isOriginAllowed(origin, allowedOrigins)) {
      if (req.method === "OPTIONS") {
        return res.status(403).end();
      }

      return next();
    }

    applyCorsHeaders(req, res, allowedOrigins);

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    return next();
  };
}

module.exports = {
  createCorsMiddleware
};
