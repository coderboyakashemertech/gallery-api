const QRCode = require("qrcode");
const speakeasy = require("speakeasy");

async function createSetup(username) {
  const secret = speakeasy.generateSecret({
    name: `Gallery (${username})`
  });

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrCodeDataUrl
  };
}

function verifyOtp(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1
  });
}

module.exports = {
  createSetup,
  verifyOtp
};
