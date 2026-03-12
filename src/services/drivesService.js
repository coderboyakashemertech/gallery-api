const fs = require("node:fs/promises");
const path = require("node:path");

const candidatePaths = [
  path.join(process.cwd(), "drives.json"),
  path.join(process.cwd(), "src", "drives.json")
];

async function findDrivesFile() {
  for (const filePath of candidatePaths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch (_error) {
      continue;
    }
  }

  const error = new Error("drives.json was not found in the project root or src directory.");
  error.status = 404;
  throw error;
}

async function loadDrives() {
  const filePath = await findDrivesFile();
  const content = await fs.readFile(filePath, "utf8");

  try {
    return JSON.parse(content);
  } catch (_error) {
    const error = new Error("drives.json contains invalid JSON.");
    error.status = 500;
    throw error;
  }
}

async function scanDirectoryTree(targetPath) {
  if (!targetPath) {
    const error = new Error("Query parameter 'path' is required.");
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  const resolvedPath = path.resolve(targetPath);

  let stats;

  try {
    stats = await fs.stat(resolvedPath);
  } catch (_error) {
    const error = new Error("The provided path does not exist.");
    error.status = 404;
    error.code = "PATH_NOT_FOUND";
    throw error;
  }

  if (!stats.isDirectory()) {
    const error = new Error("The provided path must point to a directory.");
    error.status = 400;
    error.code = "PATH_NOT_DIRECTORY";
    throw error;
  }

  return buildDirectoryNode(resolvedPath);
}

async function listFiles(targetPath) {
  const resolvedPath = await resolveDirectoryPath(targetPath);
  const files = [];

  await collectFiles(resolvedPath, files);

  files.sort((left, right) => left.path.localeCompare(right.path));

  return files;
}

async function resolveDirectoryPath(targetPath) {
  if (!targetPath) {
    const error = new Error("Query parameter 'path' is required.");
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  const resolvedPath = path.resolve(targetPath);

  let stats;

  try {
    stats = await fs.stat(resolvedPath);
  } catch (_error) {
    const error = new Error("The provided path does not exist.");
    error.status = 404;
    error.code = "PATH_NOT_FOUND";
    throw error;
  }

  if (!stats.isDirectory()) {
    const error = new Error("The provided path must point to a directory.");
    error.status = 400;
    error.code = "PATH_NOT_DIRECTORY";
    throw error;
  }

  return resolvedPath;
}

async function buildDirectoryNode(directoryPath) {
  const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  const folders = [];

  for (const entry of directoryEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);
    folders.push(await buildDirectoryNode(entryPath));
  }

  folders.sort((left, right) => left.name.localeCompare(right.name));

  return {
    name: path.basename(directoryPath),
    path: encodeURIComponent(directoryPath),
    type: "directory",
    children: folders
  };
}

async function collectFiles(directoryPath, files) {
  const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of directoryEntries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(entryPath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(entryPath);

    files.push({
      name: entry.name,
      path: encodeURIComponent(entryPath),
      size: stats.size,
      extension: path.extname(entry.name) || null,
      type: "file"
    });
  }
}

module.exports = {
  loadDrives,
  listFiles,
  scanDirectoryTree
};
