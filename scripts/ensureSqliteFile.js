const fs = require("node:fs/promises");
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(process.cwd(), ".env") });

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith("file:")) {
    return null;
  }

  const relativePath = databaseUrl.slice("file:".length);
  return path.resolve(process.cwd(), "prisma", relativePath.replace(/^\.\//, ""));
}

async function ensureSqliteFile() {
  const databasePath = resolveSqlitePath(process.env.DATABASE_URL);

  if (!databasePath) {
    console.log("DATABASE_URL is not a Prisma SQLite file path. Skipping file bootstrap.");
    return;
  }

  await fs.mkdir(path.dirname(databasePath), { recursive: true });

  try {
    await fs.access(databasePath);
  } catch (_error) {
    await fs.writeFile(databasePath, "");
  }

  console.log(`SQLite file ready at ${databasePath}`);
}

ensureSqliteFile().catch((error) => {
  console.error(error);
  process.exit(1);
});
