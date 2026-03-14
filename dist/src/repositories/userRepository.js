const prisma = require("../lib/prisma");

async function findUserByUsername(username) {
  return prisma.user.findUnique({
    where: {
      username
    }
  });
}

async function createUser(user) {
  return prisma.user.create({
    data: user
  });
}

async function updateUser(username, updates) {
  try {
    return await prisma.user.update({
      where: {
        username
      },
      data: updates
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }

    throw error;
  }
}

module.exports = {
  createUser,
  findUserByUsername,
  updateUser
};
