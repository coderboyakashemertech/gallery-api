const express = require("express");
const {
  buildGalleryFileLink,
  loadGalleryFiles,
  listFiles,
  loadDrives,
  loadGalleryFolders,
  resolveGalleryFile,
  scanDirectoryTree,
} = require("../services/drivesService");
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

  router.get("/gallery/file", async (req, res) => {
    try {
      const file = await resolveGalleryFile(req.query.path);
      return res.sendFile(file.absolutePath);
    } catch (error) {
      return sendError(res, error, "Failed to serve gallery file.");
    }
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
        data: files,
      });
    } catch (error) {
      return sendError(res, error, "Failed to load files.");
    }
  });

  router.get("/gallery/folders", async (_req, res) => {
    try {
      const folders = await loadGalleryFolders();
      return sendSuccess(res, {
        message: "Gallery folders loaded successfully.",
        data: folders,
      });
    } catch (error) {
      return sendError(res, error, "Failed to load gallery folders.");
    }
  });

  router.get("/gallery/files", async (req, res) => {
    try {
      const files = await loadGalleryFiles(req.query.path);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const data = {
        ...files,
        files: files.files.map((file) => ({
          name: file.name,
          size: file.size,
          thumbnail: file.thumbnail,
          date: file.date,
          mimetype: file.mimetype,
          url: buildGalleryFileLink(baseUrl, file.path).url,
        })),
      };

      return sendSuccess(res, {
        message: "Gallery files loaded successfully.",
        data,
      });
    } catch (error) {
      return sendError(res, error, "Failed to load gallery files.");
    }
  });

  router.get("/gallery/link", (req, res) => {
    try {
      const link = buildGalleryFileLink(req.query.baseUrl, req.query.path);
      return sendSuccess(res, {
        message: "Gallery file link generated successfully.",
        data: link,
      });
    } catch (error) {
      return sendError(res, error, "Failed to generate gallery file link.");
    }
  });

  return router;
}

module.exports = {
  createPublicRouter,
  createApiRouter,
};
