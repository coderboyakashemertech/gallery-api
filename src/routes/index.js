const express = require("express");

function createPublicRouter({ authEnabled }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json({
      name: "Gallery API",
      status: "ok",
      authEnabled,
      docs: "/docs"
    });
  });

  router.get("/health", (_req, res) => {
    res.json({ status: "healthy" });
  });

  return router;
}

function createApiRouter({ authEnabled }) {
  const router = express.Router();

  router.get("/protected", (req, res) => {
    res.json({
      message: authEnabled
        ? "Auth is enabled for this route."
        : "Auth is disabled right now. Turn on AUTH_ENABLED to protect this route.",
      auth: req.auth || null
    });
  });

  router.get("/me", (req, res) => {
    res.json({
      authEnabled,
      user: req.auth || null
    });
  });

  return router;
}

module.exports = {
  createPublicRouter,
  createApiRouter
};
