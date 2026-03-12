const express = require("express");
const { listFiles, loadDrives, scanDirectoryTree } = require("../services/drivesService");
const { sendError, sendSuccess } = require("../utils/response");

function createPublicRouter({ authEnabled }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    return sendSuccess(res, {
      message: "Gallery API is available.",
      data: {
        name: "Gallery API",
        status: "ok",
        authEnabled,
        docs: "/docs",
      },
    });
  });

  router.get("/health", (_req, res) => {
    return sendSuccess(res, {
      message: "Service health check passed.",
      data: { status: "healthy" },
    });
  });

  return router;
}

function createApiRouter({ authEnabled }) {
  const router = express.Router();

  router.get("/protected", (req, res) => {
    return sendSuccess(res, {
      message: authEnabled
        ? "Protected route accessed successfully."
        : "Protected route is currently open because authentication is disabled.",
      data: {
        auth: req.auth || null,
      },
    });
  });

  router.get("/me", (req, res) => {
    return sendSuccess(res, {
      message: "Protected user context loaded successfully.",
      data: {
        authEnabled,
        user: req.auth || null,
      },
    });
  });

  router.get("/drives", async (_req, res) => {
    try {
      const drives = await loadDrives();
      return sendSuccess(res, {
        message: "Drives loaded successfully.",
        data: drives,
      });
    } catch (error) {
      return sendError(res, error, "Failed to load drives.");
    }
  });

  router.get("/drives/folders", async (req, res) => {
    try {
      const tree = await scanDirectoryTree(req.query.path);
      return sendSuccess(res, {
        message: "Directory tree scanned successfully.",
        data: tree,
      });
    } catch (error) {
      return sendError(res, error, "Failed to scan the directory tree.");
    }
  });

  router.get("/drives/files", async (req, res) => {
    try {
      const files = await listFiles(req.query.path);
      return sendSuccess(res, {
        message: "Files loaded successfully.",
        data: files
      });
    } catch (error) {
      return sendError(res, error, "Failed to load files.");
    }
  });

  return router;
}

module.exports = {
  createPublicRouter,
  createApiRouter,
};
