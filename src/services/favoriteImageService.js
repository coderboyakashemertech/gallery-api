const path = require("path");

const { findUserByUsername } = require("../repositories/userRepository");
const {
  createFavoriteImage,
  listFavoriteImagesByUserId
} = require("../repositories/favoriteImageRepository");

function sanitizeFavoriteImage(favoriteImage) {
  return {
    id: favoriteImage.id,
    imageUrl: favoriteImage.imageUrl,
    createdAt: favoriteImage.createdAt
  };
}

async function resolveUser(username) {
  const user = await findUserByUsername(username);

  if (!user) {
    const error = new Error("user not found.");
    error.status = 404;
    throw error;
  }

  return user;
}

function extractImageFileName(imageUrl) {
  const normalizedInput = String(imageUrl || "").trim();

  if (!normalizedInput) {
    return "";
  }

  const withoutQueryOrHash = normalizedInput.split(/[?#]/, 1)[0];
  const fileName = path.win32.basename(
    path.posix.basename(withoutQueryOrHash)
  );

  return fileName.trim();
}

async function saveFavoriteImage(username, imageUrl) {
  const normalizedImageUrl = extractImageFileName(imageUrl);

  if (!normalizedImageUrl) {
    const error = new Error("imageUrl is required.");
    error.status = 400;
    throw error;
  }

  const user = await resolveUser(username);
  const favoriteImage = await createFavoriteImage({
    userId: user.id,
    imageUrl: normalizedImageUrl
  });

  return sanitizeFavoriteImage(favoriteImage);
}

async function getFavoriteImages(username) {
  const user = await resolveUser(username);
  const favoriteImages = await listFavoriteImagesByUserId(user.id);
  return favoriteImages.map(sanitizeFavoriteImage);
}

module.exports = {
  getFavoriteImages,
  saveFavoriteImage
};
