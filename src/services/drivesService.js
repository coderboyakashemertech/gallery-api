const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const candidatePaths = [
  path.join(process.cwd(), "drives.json"),
  path.join(process.cwd(), "src", "drives.json")
];
const galleryDirectoryCandidatePaths = [
  path.join(process.cwd(), "files"),
  path.join(process.cwd(), "src", "files")
];
const galleryCandidatePaths = [
  path.join(process.cwd(), "gallery.json"),
  path.join(process.cwd(), "src", "gallery.json")
];
const GALLERY_CACHE_TTL_MS = 5000;
let galleryDataCache = {
  expiresAt: 0,
  value: null
};
const driveAliasCandidates = {
  downloads: [
    "/storage/emulated/0/Download",
    "/storage/self/primary/Download",
    "/sdcard/Download"
  ],
  documents: [
    "/storage/emulated/0/Documents",
    "/storage/self/primary/Documents",
    "/sdcard/Documents"
  ],
  pictures: [
    "/storage/emulated/0/Pictures",
    "/storage/self/primary/Pictures",
    "/sdcard/Pictures"
  ],
  dcim: [
    "/storage/emulated/0/DCIM",
    "/storage/self/primary/DCIM",
    "/sdcard/DCIM"
  ]
};

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
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return parsed;
    }

    const resolvedDrives = [];

    for (const drive of parsed) {
      resolvedDrives.push(await resolveConfiguredDrive(drive));
    }

    return resolvedDrives;
  } catch (_error) {
    const error = new Error("drives.json contains invalid JSON.");
    error.status = 500;
    throw error;
  }
}

async function findGallerySources() {
  for (const filePath of galleryCandidatePaths) {
    try {
      await fs.access(filePath);
      return [filePath];
    } catch (_error) {
      continue;
    }
  }

  for (const directoryPath of galleryDirectoryCandidatePaths) {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      const jsonFiles = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => path.join(directoryPath, entry.name))
        .sort((left, right) => left.localeCompare(right));

      if (jsonFiles.length > 0) {
        return jsonFiles;
      }
    } catch (_error) {
      continue;
    }
  }

  const error = new Error(
    "No gallery index JSON files were found in files/, src/files/, gallery.json, or src/gallery.json."
  );
  error.status = 404;
  throw error;
}

async function loadGalleryFolders() {
  const parsed = await loadGalleryData();
  const folders = Array.isArray(parsed.folders) ? parsed.folders : [];
  const albums = folders.map(({ files, folder_name, folder_path, file_count, ...folder }) => ({
    ...folder,
    album_name: folder_name,
    folder: folder_path,
    item_count: file_count,
    items: Array.isArray(files) ? files.map((file) => mapFileToAlbumItem(file)) : []
  }));

  return {
    root: parsed.root || null,
    generated_at: parsed.generated_at || null,
    total_albums: albums.length,
    total_files: albums.reduce((total, album) => total + Number(album.item_count || 0), 0),
    albums,
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
    root: folder.root || null,
    album_name: folder.folder_name,
    folder: folder.folder_path,
    item_count: folder.file_count,
    items: Array.isArray(folder.files) ? folder.files.map((file) => mapFileToAlbumItem(file)) : [],
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
  const now = Date.now();

  if (galleryDataCache.value && galleryDataCache.expiresAt > now) {
    return galleryDataCache.value;
  }

  const sourcePaths = await findGallerySources();
  const mergedFolders = new Map();
  const roots = [];
  let generatedAt = null;

  for (const filePath of sourcePaths) {
    const content = await fs.readFile(filePath, "utf8");

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (_error) {
      const error = new Error(`${path.basename(filePath)} contains invalid JSON.`);
      error.status = 500;
      throw error;
    }

    const normalized = normalizeGalleryIndex(parsed);

    if (normalized.root) {
      roots.push(normalized.root);
    }

    if (normalized.generated_at !== null && normalized.generated_at !== undefined) {
      generatedAt = generatedAt === null
        ? normalized.generated_at
        : Math.max(generatedAt, normalized.generated_at);
    }

    for (const folder of normalized.folders) {
      mergeGalleryFolder(mergedFolders, folder);
    }
  }

  const folders = Array.from(mergedFolders.values()).sort((left, right) => {
    return left.folder_name.localeCompare(right.folder_name)
      || left.folder_path.localeCompare(right.folder_path);
  });

  const result = {
    root: roots.length === 1 ? roots[0] : null,
    roots: Array.from(new Set(roots)),
    generated_at: generatedAt,
    folders
  };

  galleryDataCache = {
    value: result,
    expiresAt: now + GALLERY_CACHE_TTL_MS
  };

  return result;
}

function normalizeGalleryIndex(parsed) {
  if (Array.isArray(parsed?.folders)) {
    return {
      root: parsed.root || null,
      generated_at: parsed.generated_at || null,
      folders: parsed.folders.map((folder) => normalizeGalleryFolder(folder, parsed.root || null))
    };
  }

  if (Array.isArray(parsed?.albums)) {
    return {
      root: parsed.root || null,
      generated_at: parsed.generated_at || null,
      folders: parsed.albums.map((album) => normalizeAlbumAsFolder(album, parsed.root || null))
    };
  }

  return {
    root: parsed?.root || null,
    generated_at: parsed?.generated_at || null,
    folders: []
  };
}

function normalizeGalleryFolder(folder, root) {
  const files = Array.isArray(folder?.files) ? folder.files : [];

  return {
    root,
    folder_name: folder?.folder_name || path.basename(decodeSafePath(folder?.folder_path || "")),
    folder_path: normalizeGalleryPath(folder?.folder_path || ""),
    file_count: Number.isFinite(folder?.file_count) ? folder.file_count : files.length,
    folder_size_bytes: folder?.folder_size_bytes ?? null,
    latest_mtime: folder?.latest_mtime ?? null,
    files: files.map((file) => normalizeGalleryFile(file))
  };
}

function normalizeAlbumAsFolder(album, root) {
  const items = Array.isArray(album?.items) ? album.items : [];
  const folderPath = album?.folder || "";

  return {
    root,
    folder_name: album?.album_name || path.basename(folderPath),
    folder_path: normalizeGalleryPath(folderPath),
    file_count: Number.isFinite(album?.item_count) ? album.item_count : items.length,
    folder_size_bytes: items.reduce((total, item) => total + Number(item?.size_bytes || 0), 0),
    latest_mtime: album?.last_updated ?? null,
    files: items.map((item) => ({
      name: item?.name || path.basename(item?.path || ""),
      path: normalizeGalleryPath(item?.path || ""),
      size: item?.size_bytes ?? null,
      thumbnail: "",
      date: item?.mtime ?? null,
      mimetype: inferMimeType(item?.path || item?.name || "", item?.type)
    }))
  };
}

function normalizeGalleryFile(file) {
  return {
    name: file?.name || path.basename(decodeSafePath(file?.path || "")),
    path: normalizeGalleryPath(file?.path || ""),
    size: file?.size ?? file?.size_bytes ?? null,
    thumbnail: file?.thumbnail ? normalizeGalleryPath(file.thumbnail) : "",
    date: file?.date ?? file?.mtime ?? null,
    mimetype: file?.mimetype || inferMimeType(file?.path || file?.name || "", file?.type)
  };
}

function mapFileToAlbumItem(file) {
  return {
    name: file.name,
    path: file.path,
    size_bytes: file.size ?? null,
    mtime: file.date ?? null,
    type: inferMediaType(file.mimetype),
    thumbnail: file.thumbnail || "",
    mimetype: file.mimetype || "application/octet-stream"
  };
}

function mergeGalleryFolder(folderMap, incomingFolder) {
  const folderPath = incomingFolder.folder_path;
  const existingFolder = folderMap.get(folderPath);

  if (!existingFolder) {
    folderMap.set(folderPath, {
      ...incomingFolder,
      files: dedupeGalleryFiles(incomingFolder.files)
    });
    return;
  }

  existingFolder.folder_name = existingFolder.folder_name || incomingFolder.folder_name;
  existingFolder.root = existingFolder.root || incomingFolder.root;
  existingFolder.folder_size_bytes = sumNullableNumbers(
    existingFolder.folder_size_bytes,
    incomingFolder.folder_size_bytes
  );
  existingFolder.latest_mtime = maxNullableNumber(
    existingFolder.latest_mtime,
    incomingFolder.latest_mtime
  );
  existingFolder.files = dedupeGalleryFiles(existingFolder.files.concat(incomingFolder.files));
  existingFolder.file_count = existingFolder.files.length;
}

function dedupeGalleryFiles(files) {
  const fileMap = new Map();

  for (const file of files) {
    fileMap.set(file.path, file);
  }

  return Array.from(fileMap.values()).sort((left, right) => {
    return left.name.localeCompare(right.name) || left.path.localeCompare(right.path);
  });
}

function sumNullableNumbers(left, right) {
  const leftValue = Number.isFinite(left) ? left : 0;
  const rightValue = Number.isFinite(right) ? right : 0;
  const total = leftValue + rightValue;

  return total > 0 ? total : null;
}

function maxNullableNumber(left, right) {
  if (!Number.isFinite(left)) {
    return Number.isFinite(right) ? right : null;
  }

  if (!Number.isFinite(right)) {
    return left;
  }

  return Math.max(left, right);
}

function decodeSafePath(targetPath) {
  try {
    return decodeURIComponent(targetPath);
  } catch (_error) {
    return targetPath;
  }
}

function inferMimeType(filePath, fileType) {
  const extension = path.extname(String(filePath || "")).toLowerCase();

  if ([".jpg", ".jpeg"].includes(extension)) {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  if (extension === ".bmp") {
    return "image/bmp";
  }

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  if (extension === ".mp4") {
    return "video/mp4";
  }

  if (extension === ".mov") {
    return "video/quicktime";
  }

  if (extension === ".mkv") {
    return "video/x-matroska";
  }

  if (extension === ".avi") {
    return "video/x-msvideo";
  }

  if (fileType === "image") {
    return "image/*";
  }

  if (fileType === "video") {
    return "video/*";
  }

  return "application/octet-stream";
}

function inferMediaType(mimetype) {
  const normalized = String(mimetype || "").toLowerCase();

  if (normalized.startsWith("image/")) {
    return "image";
  }

  if (normalized.startsWith("video/")) {
    return "video";
  }

  return "file";
}

async function resolveConfiguredDrive(drive) {
  if (!drive || typeof drive !== "object") {
    return drive;
  }

  const configuredPath = typeof drive.path === "string" ? drive.path : "";
  const fallbackPath = await resolveKnownDriveAlias(drive, configuredPath);
  const finalPath = fallbackPath || configuredPath;

  return {
    ...drive,
    path: finalPath
  };
}

async function resolveKnownDriveAlias(drive, configuredPath) {
  const normalizedConfiguredPath = String(configuredPath || "").trim();

  if (normalizedConfiguredPath && (await fsPathExists(normalizedConfiguredPath))) {
    return path.resolve(normalizedConfiguredPath);
  }

  const aliases = getDriveAliases(drive, normalizedConfiguredPath);

  for (const alias of aliases) {
    const candidates = driveAliasCandidates[alias] || [];
    const resolvedCandidate = await findFirstExistingDirectory(candidates);

    if (resolvedCandidate) {
      return resolvedCandidate;
    }
  }

  return normalizedConfiguredPath;
}

function getDriveAliases(drive, configuredPath) {
  const aliases = new Set();
  const driveName = typeof drive.name === "string" ? drive.name : "";
  const normalizedName = driveName.trim().toLowerCase();
  const normalizedBaseName = path.basename(configuredPath || "").trim().toLowerCase();

  for (const value of [normalizedName, normalizedBaseName]) {
    if (!value) {
      continue;
    }

    if (value === "download" || value === "downloads") {
      aliases.add("downloads");
    }

    if (value === "document" || value === "documents") {
      aliases.add("documents");
    }

    if (value === "picture" || value === "pictures") {
      aliases.add("pictures");
    }

    if (value === "dcim") {
      aliases.add("dcim");
    }
  }

  return Array.from(aliases);
}

async function findFirstExistingDirectory(candidates) {
  for (const candidate of candidates) {
    if (await fsIsDirectoryPath(candidate)) {
      return path.resolve(candidate);
    }
  }

  return null;
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

  if (await pathExists(resolvedPath)) {
    if (await isDirectoryPath(resolvedPath)) {
      const error = new Error("The folder already exists.");
      error.status = 409;
      error.code = "FOLDER_ALREADY_EXISTS";
      throw error;
    }

    const error = new Error("A file already exists at the provided path.");
    error.status = 409;
    error.code = "PATH_ALREADY_EXISTS";
    throw error;
  }

  await runSudoCommand("mkdir", ["-p", "--", resolvedPath]);

  return {
    name: folderName,
    path: encodeURIComponent(resolvedPath),
    type: "directory"
  };
}

async function fsPathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function fsIsDirectoryPath(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch (_error) {
    return false;
  }
}

async function deletePath(targetPath) {
  const { resolvedPath, stats } = await resolveExistingPath(targetPath, "path");

  await runSudoCommand("rm", ["-rf", "--", resolvedPath]);

  return {
    name: path.basename(resolvedPath),
    path: encodeURIComponent(resolvedPath),
    type: stats.isDirectory() ? "directory" : "file",
    deleted: true
  };
}

async function movePathToRecycleBin(targetPath, recycleBinPath) {
  logRecycleDebug("request.received", {
    targetPath,
    recycleBinPath
  });

  if (!recycleBinPath) {
    const error = new Error("RECYCLE_BIN_PATH is not configured.");
    error.status = 500;
    error.code = "RECYCLE_BIN_PATH_MISSING";
    logRecycleDebug("request.invalid", {
      reason: error.code,
      message: error.message
    });
    throw error;
  }

  const recycleBinResolvedPath = path.resolve(recycleBinPath);
  logRecycleDebug("recycle_bin.resolved", {
    recycleBinResolvedPath
  });

  const { resolvedPath, stats } = await resolveExistingPath(targetPath, "path");
  logRecycleDebug("source.resolved", {
    resolvedPath,
    itemType: stats.isDirectory() ? "directory" : "file"
  });

  if (
    resolvedPath === recycleBinResolvedPath ||
    resolvedPath.startsWith(`${recycleBinResolvedPath}${path.sep}`)
  ) {
    const error = new Error("The provided path is already inside the recycle bin.");
    error.status = 400;
    error.code = "PATH_ALREADY_IN_RECYCLE_BIN";
    logRecycleDebug("source.rejected", {
      reason: error.code,
      resolvedPath,
      recycleBinResolvedPath
    });
    throw error;
  }

  try {
    logRecycleDebug("recycle_bin.ensure.start", {
      recycleBinResolvedPath
    });
    await runSudoCommand("mkdir", ["-p", "--", recycleBinResolvedPath], {
      debugLabel: "recycle_bin.ensure"
    });
    logRecycleDebug("recycle_bin.ensure.success", {
      recycleBinResolvedPath
    });
  } catch (error) {
    logRecycleDebug("recycle_bin.ensure.failed", {
      recycleBinResolvedPath,
      code: error.code,
      message: error.message
    });

    if (isPermissionError(error)) {
      throw buildPermissionError(error, recycleBinResolvedPath);
    }

    throw error;
  }

  const recyclePath = await resolveRecycleDestination(
    recycleBinResolvedPath,
    path.basename(resolvedPath)
  );
  logRecycleDebug("recycle_destination.selected", {
    recyclePath
  });

  try {
    logRecycleDebug("move.start", {
      from: resolvedPath,
      to: recyclePath
    });
    await runSudoCommand("mv", ["--", resolvedPath, recyclePath], {
      debugLabel: "recycle_move"
    });
    logRecycleDebug("move.success", {
      from: resolvedPath,
      to: recyclePath
    });
  } catch (error) {
    logRecycleDebug("move.failed", {
      from: resolvedPath,
      to: recyclePath,
      code: error.code,
      message: error.message
    });

    if (isPermissionError(error)) {
      throw buildPermissionError(error, recycleBinResolvedPath);
    }

    throw error;
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
  logRecycleDebug("path.resolve.start", {
    fieldName,
    targetPath,
    resolvedPath
  });

  try {
    const stats = await fs.stat(resolvedPath);
    logRecycleDebug("path.resolve.success", {
      fieldName,
      resolvedPath,
      itemType: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other"
    });
    return { resolvedPath, stats };
  } catch (_error) {
    const error = new Error("The provided path does not exist.");
    error.status = 404;
    error.code = "PATH_NOT_FOUND";
    logRecycleDebug("path.resolve.failed", {
      fieldName,
      resolvedPath,
      reason: error.code
    });
    throw error;
  }
}

async function ensureParentDirectory(parentPath) {
  if (!(await pathExists(parentPath))) {
    const error = new Error("The parent directory does not exist.");
    error.status = 404;
    error.code = "PARENT_PATH_NOT_FOUND";
    throw error;
  }

  if (!(await isDirectoryPath(parentPath))) {
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

  logRecycleDebug("destination.probe.start", {
    recycleBinPath,
    entryName,
    candidatePath
  });

  while (await pathExists(candidatePath)) {
    logRecycleDebug("destination.probe.conflict", {
      candidatePath,
      suffix
    });
    const nextName = parsedPath.ext
      ? `${parsedPath.name}-${Date.now()}-${suffix}${parsedPath.ext}`
      : `${parsedPath.base}-${Date.now()}-${suffix}`;
    candidatePath = path.join(recycleBinPath, nextName);
    suffix += 1;
  }

  logRecycleDebug("destination.probe.available", {
    candidatePath
  });

  return candidatePath;
}

async function pathExists(targetPath) {
  const result = await runSudoCommand("test", ["-e", targetPath], {
    allowedExitCodes: [1],
  });
  return result.code === 0;
}

async function isDirectoryPath(targetPath) {
  const result = await runSudoCommand("test", ["-d", targetPath], {
    allowedExitCodes: [1],
  });
  return result.code === 0;
}

function getLinuxPassword() {
  const password = process.env.LINUX_PASSWORD;

  if (!password) {
    const error = new Error("LINUX_PASSWORD is not configured.");
    error.status = 500;
    error.code = "LINUX_PASSWORD_MISSING";
    throw error;
  }

  return password;
}

function runSudoCommand(command, args, options = {}) {
  const allowedExitCodes = options.allowedExitCodes || [];
  const debugLabel = options.debugLabel || command;
  const password = getLinuxPassword();

  return new Promise((resolve, reject) => {
    logRecycleDebug("linux_command.start", {
      debugLabel,
      command,
      args
    });

    const child = spawn("sudo", ["-S", "-p", "", "--", command, ...args]);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      logRecycleDebug("linux_command.process_error", {
        debugLabel,
        command,
        message: error.message
      });
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0 || allowedExitCodes.includes(code)) {
        logRecycleDebug("linux_command.success", {
          debugLabel,
          command,
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
        resolve({ code, stdout, stderr });
        return;
      }

      const error = new Error(stderr.trim() || `Command '${command}' failed.`);
      error.code = parseSudoErrorCode(stderr);
      error.exitCode = code;
      logRecycleDebug("linux_command.failed", {
        debugLabel,
        command,
        code,
        errorCode: error.code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
      reject(error);
    });

    child.stdin.write(`${password}\n`);
    child.stdin.end();
  });
}

function logRecycleDebug(step, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[recycle-debug] ${timestamp} ${step}`, details);
}

function parseSudoErrorCode(stderr) {
  const normalizedError = String(stderr || "").toLowerCase();

  if (normalizedError.includes("permission denied")) {
    return "EACCES";
  }

  if (normalizedError.includes("not a directory")) {
    return "ENOTDIR";
  }

  if (normalizedError.includes("no such file or directory")) {
    return "ENOENT";
  }

  return "LINUX_COMMAND_FAILED";
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
