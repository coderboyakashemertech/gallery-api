const fs = require("node:fs/promises");
const path = require("node:path");

const candidatePaths = [
  path.join(process.cwd(), "drives.json"),
  path.join(process.cwd(), "src", "drives.json")
];
const galleryCandidatePaths = [
  path.join(process.cwd(), "gallery.json"),
  path.join(process.cwd(), "src", "gallery.json")
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

async function findGalleryFile() {
  for (const filePath of galleryCandidatePaths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch (_error) {
      continue;
    }
  }

  const error = new Error("gallery.json was not found in the project root or src directory.");
  error.status = 404;
  throw error;
}

async function loadGalleryFolders() {
  const parsed = await loadGalleryData();
  const folders = Array.isArray(parsed.folders) ? parsed.folders : [];

  return {
    root: parsed.root || null,
    generated_at: parsed.generated_at || null,
    folders: folders.map(({ files: _files, ...folder }) => folder)
  };
}

async function loadGalleryFiles(targetPath) {
  if (!targetPath) {
    const error = new Error("Query parameter 'path' is required.");
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  const parsed = await loadGalleryData();
  const folders = Array.isArray(parsed.folders) ? parsed.folders : [];
  const normalizedPath = normalizeGalleryPath(targetPath);
  const folder = folders.find((entry) => entry.folder_path === normalizedPath);

  if (!folder) {
    const error = new Error("The provided gallery path was not found.");
    error.status = 404;
    error.code = "GALLERY_PATH_NOT_FOUND";
    throw error;
  }

  return {
    folder_name: folder.folder_name,
    folder_path: folder.folder_path,
    file_count: folder.file_count,
    files: Array.isArray(folder.files) ? folder.files : []
  };
}

async function resolveGalleryFile(targetPath) {
  if (!targetPath) {
    const error = new Error("Query parameter 'path' is required.");
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  const parsed = await loadGalleryData();
  const folders = Array.isArray(parsed.folders) ? parsed.folders : [];
  const normalizedPath = normalizeGalleryPath(targetPath);

  for (const folder of folders) {
    const files = Array.isArray(folder.files) ? folder.files : [];
    const file = files.find((entry) => entry.path === normalizedPath);

    if (!file) {
      continue;
    }

    const decodedPath = decodeGalleryPath(file.path);

    try {
      await fs.access(decodedPath);
    } catch (_error) {
      const error = new Error("The requested gallery file does not exist on disk.");
      error.status = 404;
      error.code = "GALLERY_FILE_MISSING";
      throw error;
    }

    return {
      ...file,
      path: file.path,
      absolutePath: decodedPath,
      folder_path: folder.folder_path,
      folder_name: folder.folder_name
    };
  }

  const error = new Error("The provided gallery file path was not found.");
  error.status = 404;
  error.code = "GALLERY_FILE_NOT_FOUND";
  throw error;
}

function buildGalleryFileLink(baseUrl, targetPath) {
  if (!baseUrl) {
    const error = new Error("Query parameter 'baseUrl' is required.");
    error.status = 400;
    error.code = "BASE_URL_REQUIRED";
    throw error;
  }

  if (!targetPath) {
    const error = new Error("Query parameter 'path' is required.");
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPath = normalizeGalleryPath(targetPath);

  return {
    baseUrl: normalizedBaseUrl,
    path: normalizedPath,
    url: `${normalizedBaseUrl}/gallery/file?path=${normalizedPath}`
  };
}

function buildDriveFileLink(baseUrl, targetPath) {
  if (!baseUrl) {
    const error = new Error("Query parameter 'baseUrl' is required.");
    error.status = 400;
    error.code = "BASE_URL_REQUIRED";
    throw error;
  }

  if (!targetPath) {
    const error = new Error("Query parameter 'path' is required.");
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return {
    baseUrl: normalizedBaseUrl,
    path: targetPath,
    url: `${normalizedBaseUrl}/drives/file?path=${targetPath}`
  };
}

async function loadGalleryData() {
  const filePath = await findGalleryFile();
  const content = await fs.readFile(filePath, "utf8");

  try {
    return JSON.parse(content);
  } catch (_error) {
    const error = new Error("gallery.json contains invalid JSON.");
    error.status = 500;
    throw error;
  }
}

function normalizeGalleryPath(targetPath) {
  try {
    return decodeURIComponent(targetPath) === targetPath
      ? encodeURIComponent(targetPath)
      : targetPath;
  } catch (_error) {
    return targetPath;
  }
}

function decodeGalleryPath(targetPath) {
  try {
    return decodeURIComponent(targetPath);
  } catch (_error) {
    const error = new Error("Query parameter 'path' must be a valid encoded path.");
    error.status = 400;
    error.code = "INVALID_PATH_ENCODING";
    throw error;
  }
}

function normalizeBaseUrl(baseUrl) {
  const trimmedBaseUrl = String(baseUrl).trim().replace(/\/+$/, "");

  if (!trimmedBaseUrl) {
    const error = new Error("Query parameter 'baseUrl' is required.");
    error.status = 400;
    error.code = "BASE_URL_REQUIRED";
    throw error;
  }

  return /^https?:\/\//i.test(trimmedBaseUrl) ? trimmedBaseUrl : `http://${trimmedBaseUrl}`;
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

  const decodedPath = decodeURIComponent(targetPath);
  const resolvedPath = path.resolve(decodedPath);

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

async function listDirectoryContents(targetPath, baseUrl, options = {}) {
  const resolvedPath = await resolveDirectoryPath(targetPath);
  const directoryEntries = await fs.readdir(resolvedPath, { withFileTypes: true });
  const includeHidden = options.hidden === true;

  const folders = [];
  const files = [];

  for (const entry of directoryEntries) {
    if (!includeHidden && entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = path.join(resolvedPath, entry.name);
    const encodedPath = encodeURIComponent(entryPath);

    if (entry.isDirectory()) {
      folders.push({
        name: entry.name,
        path: encodedPath,
        type: "directory"
      });
    } else if (entry.isFile()) {
      const stats = await fs.stat(entryPath);
      const fileData = {
        name: entry.name,
        path: encodedPath,
        size: stats.size,
        extension: path.extname(entry.name) || null,
        type: "file"
      };

      if (baseUrl) {
        fileData.url = buildDriveFileLink(baseUrl, encodedPath).url;
      }

      files.push(fileData);
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return {
    name: path.basename(resolvedPath),
    path: encodeURIComponent(resolvedPath),
    folders,
    files
  };
}

async function getDriveFile(targetPath) {
  if (!targetPath) {
    const error = new Error("Query parameter 'path' is required.");
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  const decodedPath = decodeURIComponent(targetPath);
  const resolvedPath = path.resolve(decodedPath);

  let stats;
  try {
    stats = await fs.stat(resolvedPath);
  } catch (_error) {
    const error = new Error("The provided path does not exist.");
    error.status = 404;
    error.code = "PATH_NOT_FOUND";
    throw error;
  }

  if (!stats.isFile()) {
    const error = new Error("The provided path must point to a file.");
    error.status = 400;
    error.code = "PATH_NOT_FILE";
    throw error;
  }

  return resolvedPath;
}

async function createFolder(targetPath) {
  if (!targetPath) {
    const error = new Error("Request field 'path' is required.");
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  const resolvedPath = resolveInputPath(targetPath);
  const parentPath = path.dirname(resolvedPath);
  const folderName = path.basename(resolvedPath);

  if (!folderName || folderName === "." || folderName === path.sep) {
    const error = new Error("The provided path must point to a new folder.");
    error.status = 400;
    error.code = "INVALID_FOLDER_PATH";
    throw error;
  }

  await ensureParentDirectory(parentPath);

  try {
    const existingStats = await fs.stat(resolvedPath);

    if (existingStats.isDirectory()) {
      const error = new Error("The folder already exists.");
      error.status = 409;
      error.code = "FOLDER_ALREADY_EXISTS";
      throw error;
    }

    const error = new Error("A file already exists at the provided path.");
    error.status = 409;
    error.code = "PATH_ALREADY_EXISTS";
    throw error;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(resolvedPath, { recursive: true });

  return {
    name: folderName,
    path: encodeURIComponent(resolvedPath),
    type: "directory"
  };
}

async function deletePath(targetPath) {
  const { resolvedPath, stats } = await resolveExistingPath(targetPath, "path");

  await fs.rm(resolvedPath, { recursive: true, force: false });

  return {
    name: path.basename(resolvedPath),
    path: encodeURIComponent(resolvedPath),
    type: stats.isDirectory() ? "directory" : "file",
    deleted: true
  };
}

async function movePathToRecycleBin(targetPath, recycleBinPath) {
  if (!recycleBinPath) {
    const error = new Error("RECYCLE_BIN_PATH is not configured.");
    error.status = 500;
    error.code = "RECYCLE_BIN_PATH_MISSING";
    throw error;
  }

  const recycleBinResolvedPath = path.resolve(recycleBinPath);
  const { resolvedPath, stats } = await resolveExistingPath(targetPath, "path");

  if (
    resolvedPath === recycleBinResolvedPath ||
    resolvedPath.startsWith(`${recycleBinResolvedPath}${path.sep}`)
  ) {
    const error = new Error("The provided path is already inside the recycle bin.");
    error.status = 400;
    error.code = "PATH_ALREADY_IN_RECYCLE_BIN";
    throw error;
  }

  try {
    await fs.mkdir(recycleBinResolvedPath, { recursive: true });
  } catch (error) {
    if (isPermissionError(error)) {
      throw buildPermissionError(error, recycleBinResolvedPath);
    }

    throw error;
  }

  const recyclePath = await resolveRecycleDestination(
    recycleBinResolvedPath,
    path.basename(resolvedPath)
  );

  try {
    await fs.rename(resolvedPath, recyclePath);
  } catch (error) {
    if (isPermissionError(error)) {
      throw buildPermissionError(error, recycleBinResolvedPath);
    }

    if (error.code !== "EXDEV") {
      throw error;
    }

    try {
      await copyPath(resolvedPath, recyclePath, stats);
      await fs.rm(resolvedPath, { recursive: true, force: false });
    } catch (copyError) {
      if (isPermissionError(copyError)) {
        throw buildPermissionError(copyError, recycleBinResolvedPath);
      }

      throw copyError;
    }
  }

  return {
    name: path.basename(resolvedPath),
    path: encodeURIComponent(resolvedPath),
    recyclePath: encodeURIComponent(recyclePath),
    type: stats.isDirectory() ? "directory" : "file",
    moved: true
  };
}

function resolveInputPath(targetPath) {
  const decodedPath = decodeInputPath(targetPath, "path");
  return path.resolve(decodedPath);
}

function decodeInputPath(targetPath, fieldName) {
  if (!targetPath) {
    const error = new Error(`Request field '${fieldName}' is required.`);
    error.status = 400;
    error.code = "PATH_REQUIRED";
    throw error;
  }

  try {
    return decodeURIComponent(targetPath);
  } catch (_error) {
    const error = new Error(`Request field '${fieldName}' must be a valid encoded path.`);
    error.status = 400;
    error.code = "INVALID_PATH_ENCODING";
    throw error;
  }
}

async function resolveExistingPath(targetPath, fieldName) {
  const resolvedPath = resolveInputPath(targetPath);

  try {
    const stats = await fs.stat(resolvedPath);
    return { resolvedPath, stats };
  } catch (_error) {
    const error = new Error("The provided path does not exist.");
    error.status = 404;
    error.code = "PATH_NOT_FOUND";
    throw error;
  }
}

async function ensureParentDirectory(parentPath) {
  let stats;

  try {
    stats = await fs.stat(parentPath);
  } catch (_error) {
    const error = new Error("The parent directory does not exist.");
    error.status = 404;
    error.code = "PARENT_PATH_NOT_FOUND";
    throw error;
  }

  if (!stats.isDirectory()) {
    const error = new Error("The parent path must point to a directory.");
    error.status = 400;
    error.code = "PARENT_PATH_NOT_DIRECTORY";
    throw error;
  }
}

async function resolveRecycleDestination(recycleBinPath, entryName) {
  const parsedPath = path.parse(entryName);
  let candidatePath = path.join(recycleBinPath, entryName);
  let suffix = 1;

  while (await pathExists(candidatePath)) {
    const nextName = parsedPath.ext
      ? `${parsedPath.name}-${Date.now()}-${suffix}${parsedPath.ext}`
      : `${parsedPath.base}-${Date.now()}-${suffix}`;
    candidatePath = path.join(recycleBinPath, nextName);
    suffix += 1;
  }

  return candidatePath;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function copyPath(sourcePath, destinationPath, stats) {
  if (stats.isDirectory()) {
    await fs.cp(sourcePath, destinationPath, { recursive: true });
    return;
  }

  await fs.copyFile(sourcePath, destinationPath);
}

function isPermissionError(error) {
  return error && ["EACCES", "EPERM"].includes(error.code);
}

function buildPermissionError(error, recycleBinResolvedPath) {
  const permissionError = new Error(
    `Permission denied while moving the item to the recycle bin at '${recycleBinResolvedPath}'.`
  );
  permissionError.status = 403;
  permissionError.code = error.code || "RECYCLE_BIN_PERMISSION_DENIED";
  return permissionError;
}

module.exports = {
  buildGalleryFileLink,
  resolveGalleryFile,
  loadGalleryFiles,
  loadGalleryFolders,
  loadDrives,
  listFiles,
  scanDirectoryTree,
  listDirectoryContents,
  getDriveFile,
  buildDriveFileLink,
  createFolder,
  deletePath,
  movePathToRecycleBin,
};
