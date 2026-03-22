const { findUserByUsername } = require("../repositories/userRepository");
const {
  createFavoriteImage,
  listFavoriteImagesByUserId
} = require("../repositories/favoriteImageRepository");

function sanitizeFavoriteImage(favoriteImage) {
  return {
    id: favoriteImage.id,
    imageUrl: favoriteImage.imageUrl,
    name: favoriteImage.name || null,
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

function normalizeFavoriteImageUrl(imageUrl) {
  return String(imageUrl || "").trim();
}

function normalizeFavoriteImageName(name) {
  const normalizedName = String(name || "").trim();
  return normalizedName || null;
}

async function saveFavoriteImage(username, imageUrl, name) {
  const normalizedImageUrl = normalizeFavoriteImageUrl(imageUrl);
  const normalizedName = normalizeFavoriteImageName(name);

  if (!normalizedImageUrl) {
    const error = new Error("imageUrl is required.");
    error.status = 400;
    throw error;
  }
  
  const user = await resolveUser(username);
  const favoriteImage = await createFavoriteImage({
    userId: user.id,
    imageUrl: normalizedImageUrl,
    name: normalizedName
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
