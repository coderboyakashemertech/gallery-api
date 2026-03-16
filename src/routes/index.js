const express = require("express");
const config = require("../config");
const {
  buildGalleryFileLink,
  createFolder,
  deletePath,
  movePathToRecycleBin,
  loadGalleryFiles,
  listFiles,
  loadDrives,
  loadGalleryFolders,
  resolveGalleryFile,
  scanDirectoryTree,
  listDirectoryContents,
  getDriveFile,
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

  router.get("/drives/file", async (req, res) => {
    try {
      const filePath = await getDriveFile(req.query.path);
      return res.sendFile(filePath);
    } catch (error) {
      return sendError(res, error, "Failed to serve drive file.");
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

  router.get("/drives/list", async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const contents = await listDirectoryContents(req.query.path, baseUrl, {
        hidden: req.query.hidden === "true",
      });
      return sendSuccess(res, {
        message: "Directory contents loaded successfully.",
        data: contents,
      });
    } catch (error) {
      return sendError(res, error, "Failed to load directory contents.");
    }
  });

  router.post("/drives/folder", async (req, res) => {
    try {
      const folder = await createFolder(req.body.path);
      return sendSuccess(res, {
        statusCode: 201,
        message: "Folder created successfully.",
        data: folder,
      });
    } catch (error) {
      return sendError(res, error, "Failed to create folder.");
    }
  });

  router.delete("/drives/item", async (req, res) => {
    try {
      const item = await deletePath(req.body.path || req.query.path);
      return sendSuccess(res, {
        message: "Item deleted successfully.",
        data: item,
      });
    } catch (error) {
      return sendError(res, error, "Failed to delete item.");
    }
  });

  router.post("/drives/recycle", async (req, res) => {
    try {
      const item = await movePathToRecycleBin(
        req.body.path,
        config.recycleBinPath
      );
      return sendSuccess(res, {
        message: "Item moved to recycle bin successfully.",
        data: item,
      });
    } catch (error) {
      return sendError(res, error, "Failed to move item to recycle bin.");
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
