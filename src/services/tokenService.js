const jwt = require("jsonwebtoken");
const config = require("../config");

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.username,
      username: user.username,
      name: user.name,
      twoFactorEnabled: Boolean(user.twoFactorEnabled)
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = {
  createAccessToken,
  verifyAccessToken
};
