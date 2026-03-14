const QRCode = require("qrcode");
const speakeasy = require("speakeasy");

async function createSetup(username) {
  const secret = speakeasy.generateSecret({
    name: `Gallery (${username})`
  });

  const otpauthUrl = speakeasy.otpauthURL({
    secret: secret.ascii,
    label: `Gallery:${username}`,
    issuer: "Gallery"
  });

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret: secret.base32,
    otpauthUrl,
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
