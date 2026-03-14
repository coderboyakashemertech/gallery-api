const bcrypt = require("bcryptjs");
const {
  createUser,
  findUserByUsername,
  updateUser
} = require("../repositories/userRepository");
const { createAccessToken } = require("./tokenService");
const { createSetup, verifyOtp } = require("./twoFactorService");

function sanitizeUser(user) {
  return {
    username: user.username,
    name: user.name,
    twoFactorEnabled: Boolean(user.twoFactorEnabled)
  };
}

function validateRegistrationInput({ username, name, password }) {
  if (!username || !name || !password) {
    const error = new Error("username, name and password are required.");
    error.status = 400;
    throw error;
  }
}

async function registerUser({ username, name, password }) {
  validateRegistrationInput({ username, name, password });

  const normalizedUsername = String(username).trim().toLowerCase();
  const normalizedName = String(name).trim();

  if (normalizedUsername.length < 3 || normalizedName.length < 2 || password.length < 8) {
    const error = new Error(
      "username must be at least 3 chars, name at least 2 chars and password at least 8 chars."
    );
    error.status = 400;
    throw error;
  }

  const existingUser = await findUserByUsername(normalizedUsername);

  if (existingUser) {
    const error = new Error("username already exists.");
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await createUser({
    username: normalizedUsername,
    name: normalizedName,
    passwordHash,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorPendingSecret: null
  });

  return {
    token: createAccessToken(user),
    user: sanitizeUser(user)
  };
}

async function loginUser({ username, password, otp }) {
  if (!username || !password) {
    const error = new Error("username and password are required.");
    error.status = 400;
    throw error;
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const user = await findUserByUsername(normalizedUsername);

  if (!user) {
    const error = new Error("invalid username or password.");
    error.status = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    const error = new Error("invalid username or password.");
    error.status = 401;
    throw error;
  }

  if (user.twoFactorEnabled) {
    if (!otp) {
      return {
        requiresTwoFactor: true,
        token: null,
        user: sanitizeUser(user)
      };
    }

    const sanitizedOtp = String(otp).replace(/\D/g, "");
    const isValidOtp = verifyOtp(user.twoFactorSecret, sanitizedOtp);

    if (!isValidOtp) {
      const error = new Error("invalid two-factor code.");
      error.status = 401;
      throw error;
    }
  }

  return {
    requiresTwoFactor: false,
    token: createAccessToken(user),
    user: sanitizeUser(user)
  };
}

async function getUserProfile(username) {
  const user = await findUserByUsername(username);

  if (!user) {
    const error = new Error("user not found.");
    error.status = 404;
    throw error;
  }

  return sanitizeUser(user);
}

async function beginTwoFactorSetup(username) {
  const user = await findUserByUsername(username);

  if (!user) {
    const error = new Error("user not found.");
    error.status = 404;
    throw error;
  }

  const setup = await createSetup(username);

  await updateUser(username, {
    twoFactorPendingSecret: setup.secret
  });

  return {
    secret: setup.secret,
    otpauthUrl: setup.otpauthUrl,
    qrCodeDataUrl: setup.qrCodeDataUrl
  };
}

async function verifyTwoFactorSetup(username, otp) {
  if (!otp) {
    const error = new Error("otp is required.");
    error.status = 400;
    throw error;
  }

  const user = await findUserByUsername(username);

  if (!user || !user.twoFactorPendingSecret) {
    const error = new Error("no pending 2fa setup found.");
    error.status = 400;
    throw error;
  }

  const sanitizedOtp = String(otp).replace(/\D/g, "");
  const isValidOtp = verifyOtp(user.twoFactorPendingSecret, sanitizedOtp);

  if (!isValidOtp) {
    const error = new Error("invalid two-factor code.");
    error.status = 401;
    throw error;
  }

  const updatedUser = await updateUser(username, {
    twoFactorEnabled: true,
    twoFactorSecret: user.twoFactorPendingSecret,
    twoFactorPendingSecret: null
  });

  return sanitizeUser(updatedUser);
}

async function disableTwoFactor(username, otp) {
  if (!otp) {
    const error = new Error("otp is required.");
    error.status = 400;
    throw error;
  }

  const user = await findUserByUsername(username);

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    const error = new Error("2fa is not enabled.");
    error.status = 400;
    throw error;
  }

  const sanitizedOtp = String(otp).replace(/\D/g, "");
  const isValidOtp = verifyOtp(user.twoFactorSecret, sanitizedOtp);

  if (!isValidOtp) {
    const error = new Error("invalid two-factor code.");
    error.status = 401;
    throw error;
  }

  const updatedUser = await updateUser(username, {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorPendingSecret: null
  });

  return sanitizeUser(updatedUser);
}

module.exports = {
  beginTwoFactorSetup,
  disableTwoFactor,
  getUserProfile,
  loginUser,
  registerUser,
  verifyTwoFactorSetup
};
