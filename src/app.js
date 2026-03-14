const express = require("express");
const swaggerUi = require("swagger-ui-express");
const config = require("./config");
const { openApiSpec, swaggerUiOptions } = require("./docs/openapi");
const { createAuthMiddleware } = require("./middleware/auth");
const { createCorsMiddleware } = require("./middleware/cors");
const { createAuthEntryRouter, createAuthRouter } = require("./routes/auth");
const { createApiRouter, createPublicRouter } = require("./routes");
const { sendError } = require("./utils/response");

function createApp() {
  const app = express();

  app.use(createCorsMiddleware({ allowedOrigins: config.corsAllowedOrigins }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.get("/docs.json", (_req, res) => {
    return res.json(openApiSpec);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
  app.use(createPublicRouter({ authEnabled: config.authEnabled }));
  app.use("/auth", createAuthRouter());
  app.use("/api", createAuthEntryRouter());
  app.use("/api/auth", createAuthRouter());
  app.use(
    "/api",
    createAuthMiddleware({ authEnabled: config.authEnabled }),
    createApiRouter({ authEnabled: config.authEnabled })
  );

  app.use((req, res) => {
    const error = new Error(`Route ${req.originalUrl} was not found.`);
    error.status = 404;
    error.code = "NOT_FOUND";
    return sendError(res, error, "Resource not found.");
  });

  return app;
}

module.exports = {
  createApp
};
