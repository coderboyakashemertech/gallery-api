const prisma = require('../lib/prisma');

const albumInclude = {
  _count: {
    select: {
      images: true,
    },
  },
  images: {
    take: 1,
    orderBy: {
      createdAt: 'desc',
    },
  },
};

async function createAlbum({ userId, name }) {
  return prisma.album.upsert({
    where: {
      userId_name: {
        userId,
        name,
      },
    },
    update: {},
    create: {
      userId,
      name,
    },
    include: albumInclude,
  });
}

async function listAlbumsByUserId(userId) {
  return prisma.album.findMany({
    where: {
      userId,
    },
    include: albumInclude,
    orderBy: [
      {
        updatedAt: 'desc',
      },
      {
        createdAt: 'desc',
      },
    ],
  });
}

async function findAlbumByIdForUser({ albumId, userId }) {
  return prisma.album.findFirst({
    where: {
      id: albumId,
      userId,
    },
    include: albumInclude,
  });
}

async function createAlbumImage({ albumId, imageUrl, name }) {
  const update = name ? { name } : {};

  return prisma.albumImage.upsert({
    where: {
      albumId_imageUrl: {
        albumId,
        imageUrl,
      },
    },
    update,
    create: {
      albumId,
      imageUrl,
      name: name || null,
    },
  });
}

async function listAlbumImagesByAlbumId(albumId) {
  return prisma.albumImage.findMany({
    where: {
      albumId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

module.exports = {
  createAlbum,
  createAlbumImage,
  findAlbumByIdForUser,
  listAlbumImagesByAlbumId,
  listAlbumsByUserId,
};
