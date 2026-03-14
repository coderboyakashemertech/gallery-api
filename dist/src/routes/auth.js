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
const { sendError, sendMethodNotAllowed, sendSuccess } = require("../utils/response");

function registerEntryRoutes(router) {
  router.post("/register", async (req, res) => {
    try {
      const result = await registerUser(req.body);
      return sendSuccess(res, {
        statusCode: 201,
        message: "User registered successfully.",
        data: result
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.all("/register", (_req, res) => sendMethodNotAllowed(res, ["POST"]));

  router.post("/login", async (req, res) => {
    try {
      const result = await loginUser(req.body);
      return sendSuccess(res, {
        message: result.requiresTwoFactor
          ? "Two-factor authentication is required to complete login."
          : "Login completed successfully.",
        data: result
      });
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
      return sendSuccess(res, {
        message: "Authenticated user loaded successfully.",
        data: { user }
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post("/2fa/setup", requireJwt, async (req, res) => {
    try {
      const setup = await beginTwoFactorSetup(req.auth.username);
      return sendSuccess(res, {
        message: "Scan the QR code and verify with your authenticator app.",
        data: setup
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post("/2fa/verify", requireJwt, async (req, res) => {
    try {
      const user = await verifyTwoFactorSetup(req.auth.username, req.body.otp);
      return sendSuccess(res, {
        message: "2FA enabled successfully.",
        data: { user }
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post("/2fa/disable", requireJwt, async (req, res) => {
    try {
      const user = await disableTwoFactor(req.auth.username, req.body.otp);
      return sendSuccess(res, {
        message: "2FA disabled successfully.",
        data: { user }
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
