const express = require("express");
const swaggerUi = require("swagger-ui-express");
const config = require("./config");
const { openApiSpec, swaggerUiOptions } = require("./docs/openapi");
const { createAuthMiddleware } = require("./middleware/auth");
const { createAuthEntryRouter, createAuthRouter } = require("./routes/auth");
const { createApiRouter, createPublicRouter } = require("./routes");

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.get("/docs.json", (_req, res) => {
    res.json(openApiSpec);
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
    res.status(404).json({
      error: "Not Found",
      path: req.originalUrl
    });
  });

  return app;
}

module.exports = {
  createApp
};
