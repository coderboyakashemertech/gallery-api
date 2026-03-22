const prisma = require("../lib/prisma");

async function createFavoriteImage({ userId, imageUrl, name }) {
  const update = name ? { name } : {};

  return prisma.favoriteImage.upsert({
    where: {
      userId_imageUrl: {
        userId,
        imageUrl
      }
    },
    update,
    create: {
      userId,
      imageUrl,
      name: name || null
    }
  });
}

async function listFavoriteImagesByUserId(userId) {
  return prisma.favoriteImage.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

module.exports = {
  createFavoriteImage,
  listFavoriteImagesByUserId
};
