const express = require("express");
const { requireJwt } = require("../middleware/auth");
const {
  beginTwoFactorSetup,
  disableTwoFactor,
  getUserProfile,
  loginUser,
  registerUser,
  verifyTwoFactorSetup
} = require("../services/userService");

function sendError(res, error) {
  return res.status(error.status || 500).json({
    error: error.message || "Internal Server Error"
  });
}

function sendMethodNotAllowed(res, allowedMethods) {
  res.set("Allow", allowedMethods.join(", "));
  return res.status(405).json({
    error: "Method Not Allowed",
    message: `Use ${allowedMethods.join(" or ")} for this endpoint.`
  });
}

function registerEntryRoutes(router) {
  router.post("/register", async (req, res) => {
    try {
      const result = await registerUser(req.body);
      return res.status(201).json({
        message: "User registered successfully.",
        ...result
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.all("/register", (_req, res) => sendMethodNotAllowed(res, ["POST"]));

  router.post("/login", async (req, res) => {
    try {
      const result = await loginUser(req.body);
      return res.json(result);
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.all("/login", (_req, res) => sendMethodNotAllowed(res, ["POST"]));
}

function registerProtectedRoutes(router) {
  router.get("/me", requireJwt, async (req, res) => {
    try {
      const user = await getUserProfile(req.auth.username);
      return res.json({ user });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post("/2fa/setup", requireJwt, async (req, res) => {
    try {
      const setup = await beginTwoFactorSetup(req.auth.username);
      return res.json({
        message: "Scan the QR code and verify with your authenticator app.",
        ...setup
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post("/2fa/verify", requireJwt, async (req, res) => {
    try {
      const user = await verifyTwoFactorSetup(req.auth.username, req.body.otp);
      return res.json({
        message: "2FA enabled successfully.",
        user
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post("/2fa/disable", requireJwt, async (req, res) => {
    try {
      const user = await disableTwoFactor(req.auth.username, req.body.otp);
      return res.json({
        message: "2FA disabled successfully.",
        user
      });
    } catch (error) {
      return sendError(res, error);
    }
  });
}

function createAuthRouter() {
  const router = express.Router();

  registerEntryRoutes(router);
  registerProtectedRoutes(router);

  return router;
}

function createAuthEntryRouter() {
  const router = express.Router();

  registerEntryRoutes(router);

  return router;
}

module.exports = {
  createAuthEntryRouter,
  createAuthRouter
};
