const { findUserByUsername } = require('../repositories/userRepository');
const {
  createAlbum,
  createAlbumImage,
  findAlbumByIdForUser,
  listAlbumImagesByAlbumId,
  listAlbumsByUserId,
} = require('../repositories/albumRepository');

function sanitizeAlbum(album) {
  return {
    id: album.id,
    name: album.name,
    imageCount: album._count?.images || 0,
    coverImageUrl: album.images?.[0]?.imageUrl || null,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  };
}

function sanitizeAlbumImage(albumImage) {
  return {
    id: albumImage.id,
    albumId: albumImage.albumId,
    imageUrl: albumImage.imageUrl,
    name: albumImage.name || null,
    createdAt: albumImage.createdAt,
  };
}

async function resolveUser(username) {
  const user = await findUserByUsername(username);

  if (!user) {
    const error = new Error('user not found.');
    error.status = 404;
    throw error;
  }

  return user;
}

function normalizeName(value, fieldName) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    const error = new Error(`${fieldName} is required.`);
    error.status = 400;
    throw error;
  }

  return normalizedValue;
}

function normalizeOptionalName(value) {
  const normalizedValue = String(value || '').trim();
  return normalizedValue || null;
}

function normalizeAlbumId(albumId) {
  const parsedAlbumId = Number(albumId);

  if (!Number.isInteger(parsedAlbumId) || parsedAlbumId <= 0) {
    const error = new Error('albumId must be a valid positive integer.');
    error.status = 400;
    throw error;
  }

  return parsedAlbumId;
}

async function resolveAlbum(username, albumId) {
  const user = await resolveUser(username);
  const parsedAlbumId = normalizeAlbumId(albumId);
  const album = await findAlbumByIdForUser({
    albumId: parsedAlbumId,
    userId: user.id,
  });

  if (!album) {
    const error = new Error('album not found.');
    error.status = 404;
    throw error;
  }

  return { album, user };
}

async function createUserAlbum(username, name) {
  const normalizedName = normalizeName(name, 'name');
  const user = await resolveUser(username);
  const album = await createAlbum({
    userId: user.id,
    name: normalizedName,
  });

  return sanitizeAlbum(album);
}

async function getAlbums(username) {
  const user = await resolveUser(username);
  const albums = await listAlbumsByUserId(user.id);
  return albums.map(sanitizeAlbum);
}

async function saveAlbumImage(username, albumId, imageUrl, name) {
  const normalizedImageUrl = normalizeName(imageUrl, 'imageUrl');
  const normalizedName = normalizeOptionalName(name);
  const { album } = await resolveAlbum(username, albumId);
  const albumImage = await createAlbumImage({
    albumId: album.id,
    imageUrl: normalizedImageUrl,
    name: normalizedName,
  });

  return sanitizeAlbumImage(albumImage);
}

async function getAlbumImages(username, albumId) {
  const { album } = await resolveAlbum(username, albumId);
  const albumImages = await listAlbumImagesByAlbumId(album.id);
  return albumImages.map(sanitizeAlbumImage);
}

module.exports = {
  createUserAlbum,
  getAlbumImages,
  getAlbums,
  saveAlbumImage,
};
