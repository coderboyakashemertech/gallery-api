function sendSuccess(res, { statusCode = 200, message = "Request completed successfully.", data = null, meta } = {}) {
  const body = {
    success: true,
    message,
    data
  };

  if (meta !== undefined) {
    body.meta = meta;
  }

  return res.status(statusCode).json(body);
}

function sendError(res, error, fallbackMessage = "Internal Server Error") {
  const statusCode = error.status || error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
    error: {
      code: error.code || "REQUEST_FAILED",
      statusCode
    }
  });
}

function sendMethodNotAllowed(res, allowedMethods) {
  res.set("Allow", allowedMethods.join(", "));

  return res.status(405).json({
    success: false,
    message: `Use ${allowedMethods.join(" or ")} for this endpoint.`,
    error: {
      code: "METHOD_NOT_ALLOWED",
      statusCode: 405
    }
  });
}

module.exports = {
  sendError,
  sendMethodNotAllowed,
  sendSuccess
};
