#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="${1:-$ROOT_DIR/src/files}"
OUTPUT_FILE="${2:-$ROOT_DIR/src/gallery.json}"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

TMP_SCRIPT="$(mktemp)"
cleanup() {
  rm -f "$TMP_SCRIPT"
}
trap cleanup EXIT

cat > "$TMP_SCRIPT" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const sourceDir = process.argv[2];
const outputFile = process.argv[3];

const files = fs.readdirSync(sourceDir)
  .filter((name) => name.toLowerCase().endsWith(".json"))
  .sort((left, right) => left.localeCompare(right));

if (files.length === 0) {
  throw new Error(`No JSON files found in ${sourceDir}`);
}

const mergedFolders = new Map();
const roots = [];
let generatedAt = null;

for (const fileName of files) {
  const filePath = path.join(sourceDir, fileName);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
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
    mergeFolder(mergedFolders, folder);
  }
}

const folders = Array.from(mergedFolders.values()).sort((left, right) => {
  return left.folder_name.localeCompare(right.folder_name)
    || left.folder_path.localeCompare(right.folder_path);
});

const output = {
  root: Array.from(new Set(roots)).length === 1 ? roots[0] : null,
  generated_at: generatedAt,
  folders
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2) + "\n");

console.log(`Merged ${files.length} files into ${folders.length} folders`);
console.log(`Output: ${outputFile}`);

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

function mergeFolder(folderMap, incomingFolder) {
  const key = incomingFolder.folder_path;
  const existing = folderMap.get(key);

  if (!existing) {
    folderMap.set(key, {
      ...incomingFolder,
      files: dedupeFiles(incomingFolder.files)
    });
    return;
  }

  existing.folder_name = existing.folder_name || incomingFolder.folder_name;
  existing.root = existing.root || incomingFolder.root;
  existing.folder_size_bytes = sumNullable(existing.folder_size_bytes, incomingFolder.folder_size_bytes);
  existing.latest_mtime = maxNullable(existing.latest_mtime, incomingFolder.latest_mtime);
  existing.files = dedupeFiles(existing.files.concat(incomingFolder.files));
  existing.file_count = existing.files.length;
}

function dedupeFiles(files) {
  const fileMap = new Map();

  for (const file of files) {
    fileMap.set(file.path, file);
  }

  return Array.from(fileMap.values()).sort((left, right) => {
    return left.name.localeCompare(right.name) || left.path.localeCompare(right.path);
  });
}

function sumNullable(left, right) {
  const leftValue = Number.isFinite(left) ? left : 0;
  const rightValue = Number.isFinite(right) ? right : 0;
  const total = leftValue + rightValue;
  return total > 0 ? total : null;
}

function maxNullable(left, right) {
  if (!Number.isFinite(left)) {
    return Number.isFinite(right) ? right : null;
  }

  if (!Number.isFinite(right)) {
    return left;
  }

  return Math.max(left, right);
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

function decodeSafePath(targetPath) {
  try {
    return decodeURIComponent(targetPath);
  } catch (_error) {
    return targetPath;
  }
}

function inferMimeType(filePath, fileType) {
  const extension = path.extname(String(filePath || "")).toLowerCase();

  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".bmp") return "image/bmp";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".mkv") return "video/x-matroska";
  if (extension === ".avi") return "video/x-msvideo";
  if (fileType === "image") return "image/*";
  if (fileType === "video") return "video/*";

  return "application/octet-stream";
}
EOF

node "$TMP_SCRIPT" "$SOURCE_DIR" "$OUTPUT_FILE"
