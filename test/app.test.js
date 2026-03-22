const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");

function clearProjectModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(srcRoot)) {
      delete require.cache[key];
    }
  }
}

function mockModule(relativePath, exports) {
  const filePath = path.join(projectRoot, relativePath);
  const previous = require.cache[filePath];

  require.cache[filePath] = {
    id: filePath,
    filename: filePath,
    loaded: true,
    exports
  };

  return () => {
    if (previous) {
      require.cache[filePath] = previous;
      return;
    }

    delete require.cache[filePath];
  };
}

function createDefaultState(files) {
  return {
    verifyAccessToken: (token) => ({
      username: "alice",
      name: "Alice",
      twoFactorEnabled: true,
      token
    }),
    registerUser: async (body) => ({
      token: `registered-${body.username}`,
      user: {
        username: body.username,
        name: body.name,
        twoFactorEnabled: false
      }
    }),
    loginUser: async (body) => ({
      requiresTwoFactor: false,
      token: `login-${body.username}`,
      user: {
        username: body.username,
        name: "Alice",
        twoFactorEnabled: false
      }
    }),
    getUserProfile: async (username) => ({
      username,
      name: "Alice",
      twoFactorEnabled: true
    }),
    beginTwoFactorSetup: async (username) => ({
      username,
      secret: "BASE32SECRET",
      otpauthUrl: "otpauth://totp/Gallery:alice",
      qrCodeDataUrl: "data:image/png;base64,abc"
    }),
    verifyTwoFactorSetup: async (username, otp) => ({
      username,
      verifiedWith: otp,
      twoFactorEnabled: true
    }),
    disableTwoFactor: async (username, otp) => ({
      username,
      disabledWith: otp,
      twoFactorEnabled: false
    }),
    loadDrives: async () => [
      { name: "Media", path: "/mnt/media" },
      { name: "Downloads", path: "/mnt/downloads" }
    ],
    scanDirectoryTree: async (targetPath) => ({
      name: "root",
      path: targetPath,
      children: [{ name: "nested", path: `${targetPath}/nested`, children: [] }]
    }),
    listFiles: async (targetPath) => ({
      path: targetPath,
      files: [{ name: "notes.txt", path: `${targetPath}/notes.txt`, size: 42 }]
    }),
    listDirectoryContents: async (targetPath, baseUrl, options) => ({
      path: targetPath,
      baseUrl,
      options,
      items: [
        {
          name: "holiday.jpg",
          type: "file",
          url: `${baseUrl}/drives/file?path=${encodeURIComponent(`${targetPath}/holiday.jpg`)}`
        }
      ]
    }),
    createFolder: async (targetPath) => ({
      path: targetPath,
      created: true
    }),
    deletePath: async (targetPath) => ({
      path: targetPath,
      deleted: true
    }),
    movePathToRecycleBin: async (targetPath, recycleBinPath) => ({
      path: targetPath,
      recycleBinPath,
      moved: true
    }),
    loadGalleryFolders: async () => ({
      root: "/gallery",
      generated_at: "2026-03-20T00:00:00.000Z",
      folders: [{ folder_name: "Trips", folder_path: "/gallery/trips", file_count: 1 }]
    }),
    loadGalleryFiles: async (targetPath) => ({
      folder_name: "Trips",
      folder_path: targetPath,
      file_count: 1,
      files: [
        {
          name: "sunset.jpg",
          size: 321,
          thumbnail: "thumb.jpg",
          date: "2026-03-20",
          mimetype: "image/jpeg",
          path: `${targetPath}/sunset.jpg`
        }
      ]
    }),
    buildGalleryFileLink: (baseUrl, targetPath) => ({
      baseUrl,
      path: targetPath,
      url: `${baseUrl}/gallery/file?path=${encodeURIComponent(targetPath)}`
    }),
    resolveGalleryFile: async (targetPath) => ({
      absolutePath: files.galleryFile,
      path: targetPath,
      folder_path: "/gallery/trips",
      folder_name: "Trips"
    }),
    getDriveFile: async () => files.driveFile,
    getFavoriteImages: async (username) => [
      {
        id: 1,
        imageUrl: `https://cdn.example.com/${username}/favorite.jpg`,
        name: "favorite.jpg",
        createdAt: "2026-03-20T10:00:00.000Z"
      }
    ],
    saveFavoriteImage: async (username, imageUrl, name) => ({
      id: 2,
      imageUrl,
      name: name || null,
      createdAt: `saved-for-${username}`
    }),
    getAlbums: async (username) => [
      {
        id: 3,
        name: `${username}-album`,
        imageCount: 1,
        coverImageUrl: `https://cdn.example.com/${username}/album-cover.jpg`,
        createdAt: '2026-03-21T10:00:00.000Z',
        updatedAt: '2026-03-21T12:00:00.000Z'
      }
    ],
    createUserAlbum: async (username, name) => ({
      id: 4,
      name,
      imageCount: 0,
      coverImageUrl: null,
      createdAt: `created-for-${username}`,
      updatedAt: `updated-for-${username}`
    }),
    getAlbumImages: async (_username, albumId) => [
      {
        id: 5,
        albumId: Number(albumId),
        imageUrl: 'https://cdn.example.com/albums/sunset.jpg',
        name: 'sunset.jpg',
        createdAt: '2026-03-21T14:00:00.000Z'
      }
    ],
    saveAlbumImage: async (_username, albumId, imageUrl, name) => ({
      id: 6,
      albumId: Number(albumId),
      imageUrl,
      name: name || null,
      createdAt: '2026-03-21T15:00:00.000Z'
    })
  };
}

function loadAppWithMocks({ authEnabled, recycleBinPath, files }) {
  clearProjectModules();

  const state = createDefaultState(files);
  const restoreFns = [
    mockModule("src/config.js", {
      env: "test",
      port: 0,
      authEnabled,
      corsAllowedOrigins: ["*"],
      jwtSecret: "test-secret",
      jwtExpiresIn: "1h",
      recycleBinPath
    }),
    mockModule("src/services/tokenService.js", {
      verifyAccessToken: (...args) => state.verifyAccessToken(...args)
    }),
    mockModule("src/services/userService.js", {
      registerUser: (...args) => state.registerUser(...args),
      loginUser: (...args) => state.loginUser(...args),
      getUserProfile: (...args) => state.getUserProfile(...args),
      beginTwoFactorSetup: (...args) => state.beginTwoFactorSetup(...args),
      verifyTwoFactorSetup: (...args) => state.verifyTwoFactorSetup(...args),
      disableTwoFactor: (...args) => state.disableTwoFactor(...args)
    }),
    mockModule("src/services/drivesService.js", {
      loadDrives: (...args) => state.loadDrives(...args),
      scanDirectoryTree: (...args) => state.scanDirectoryTree(...args),
      listFiles: (...args) => state.listFiles(...args),
      listDirectoryContents: (...args) => state.listDirectoryContents(...args),
      createFolder: (...args) => state.createFolder(...args),
      deletePath: (...args) => state.deletePath(...args),
      movePathToRecycleBin: (...args) => state.movePathToRecycleBin(...args),
      loadGalleryFolders: (...args) => state.loadGalleryFolders(...args),
      loadGalleryFiles: (...args) => state.loadGalleryFiles(...args),
      buildGalleryFileLink: (...args) => state.buildGalleryFileLink(...args),
      resolveGalleryFile: (...args) => state.resolveGalleryFile(...args),
      getDriveFile: (...args) => state.getDriveFile(...args)
    }),
    mockModule("src/services/favoriteImageService.js", {
      getFavoriteImages: (...args) => state.getFavoriteImages(...args),
      saveFavoriteImage: (...args) => state.saveFavoriteImage(...args)
    }),
    mockModule("src/services/albumService.js", {
      getAlbums: (...args) => state.getAlbums(...args),
      createUserAlbum: (...args) => state.createUserAlbum(...args),
      getAlbumImages: (...args) => state.getAlbumImages(...args),
      saveAlbumImage: (...args) => state.saveAlbumImage(...args)
    })
  ];

  const { createApp } = require("../src/app");

  return {
    app: createApp(),
    cleanup: () => {
      clearProjectModules();
      for (const restore of restoreFns.reverse()) {
        restore();
      }
    }
  };
}

async function startServer(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: "manual",
    ...options
  });
  const contentType = response.headers.get("content-type") || "";
  let body;

  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return { response, body };
}

async function createFixtureFiles() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gallery-api-tests-"));
  const galleryFile = path.join(tempDir, "gallery.txt");
  const driveFile = path.join(tempDir, "drive.txt");

  await fs.writeFile(galleryFile, "gallery-file");
  await fs.writeFile(driveFile, "drive-file");

  return { tempDir, galleryFile, driveFile };
}

test("public, auth, protected, and docs endpoints respond as expected when auth is enabled", async (t) => {
  const files = await createFixtureFiles();
  const loaded = loadAppWithMocks({
    authEnabled: true,
    recycleBinPath: "/tmp/recycle bin",
    files
  });
  const { server, baseUrl } = await startServer(loaded.app);
  const authHeaders = { authorization: "Bearer good-token", "content-type": "application/json" };

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(files.tempDir, { recursive: true, force: true });
    loaded.cleanup();
  });

  {
    const { response, body } = await request(baseUrl, "/");
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.authEnabled, true);
  }

  {
    const { response, body } = await request(baseUrl, "/health");
    assert.equal(response.status, 200);
    assert.equal(body.data.status, "healthy");
  }

  {
    const { response, body } = await request(baseUrl, "/docs.json");
    assert.equal(response.status, 200);
    assert.equal(body.openapi, "3.0.3");
  }

  {
    const { response, body } = await request(baseUrl, "/docs/");
    assert.equal(response.status, 200);
    assert.match(body, /Gallery API Docs|swagger-ui/i);
  }

  {
    const { response, body } = await request(baseUrl, "/gallery/file?path=%2Fgallery%2Ftrips%2Fsunset.jpg");
    assert.equal(response.status, 200);
    assert.equal(body, "gallery-file");
  }

  {
    const { response, body } = await request(baseUrl, "/drives/file?path=%2Fmnt%2Fdownloads%2Fphoto.jpg");
    assert.equal(response.status, 200);
    assert.equal(body, "drive-file");
  }

  for (const pathname of ["/auth/register", "/api/register", "/api/auth/register"]) {
    const { response, body } = await request(baseUrl, pathname, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "new-user",
        name: "New User",
        password: "password123"
      })
    });

    assert.equal(response.status, 201, pathname);
    assert.equal(body.data.user.username, "new-user");
  }

  for (const pathname of ["/auth/login", "/api/login", "/api/auth/login"]) {
    const { response, body } = await request(baseUrl, pathname, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "alice",
        password: "password123"
      })
    });

    assert.equal(response.status, 200, pathname);
    assert.equal(body.data.token, "login-alice");
  }

  {
    const { response, body } = await request(baseUrl, "/auth/register");
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
    assert.equal(body.error.code, "METHOD_NOT_ALLOWED");
  }

  for (const prefix of ["/auth", "/api/auth"]) {
    const me = await request(baseUrl, `${prefix}/me`, {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(me.response.status, 200, `${prefix}/me`);
    assert.equal(me.body.data.user.username, "alice");

    const setup = await request(baseUrl, `${prefix}/2fa/setup`, {
      method: "POST",
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(setup.response.status, 200, `${prefix}/2fa/setup`);
    assert.equal(setup.body.data.secret, "BASE32SECRET");

    const verify = await request(baseUrl, `${prefix}/2fa/verify`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ otp: "123456" })
    });
    assert.equal(verify.response.status, 200, `${prefix}/2fa/verify`);
    assert.equal(verify.body.data.user.verifiedWith, "123456");

    const disable = await request(baseUrl, `${prefix}/2fa/disable`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ otp: "123456" })
    });
    assert.equal(disable.response.status, 200, `${prefix}/2fa/disable`);
    assert.equal(disable.body.data.user.disabledWith, "123456");
  }

  {
    const { response, body } = await request(baseUrl, "/api/protected", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.auth.username, "alice");
  }

  {
    const { response, body } = await request(baseUrl, "/api/me", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.authEnabled, true);
  }

  {
    const { response, body } = await request(baseUrl, "/api/drives", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.length, 2);
  }

  {
    const { response, body } = await request(baseUrl, "/api/drives/recycle-bin", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.path, encodeURIComponent("/tmp/recycle bin"));
  }

  {
    const { response, body } = await request(baseUrl, "/api/drives/folders?path=%2Fmnt%2Fmedia", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.path, "/mnt/media");
  }

  {
    const { response, body } = await request(baseUrl, "/api/drives/files?path=%2Fmnt%2Fmedia", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.files[0].name, "notes.txt");
  }

  {
    const { response, body } = await request(baseUrl, "/api/drives/list?path=%2Fmnt%2Fmedia&hidden=true", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.path, "/mnt/media");
    assert.equal(body.data.baseUrl, baseUrl);
    assert.deepEqual(body.data.options, { hidden: true });
  }

  {
    const { response, body } = await request(baseUrl, "/api/drives/folder", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ path: "/mnt/media/new-folder" })
    });
    assert.equal(response.status, 201);
    assert.equal(body.data.path, "/mnt/media/new-folder");
  }

  {
    const { response, body } = await request(baseUrl, "/api/drives/item", {
      method: "DELETE",
      headers: authHeaders,
      body: JSON.stringify({ path: "/mnt/media/old.txt" })
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.deleted, true);
  }

  {
    const { response, body } = await request(baseUrl, "/api/drives/recycle", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ path: "/mnt/media/trash.txt" })
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.recycleBinPath, "/tmp/recycle bin");
  }

  {
    const { response, body } = await request(baseUrl, "/api/gallery/folders", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.folders[0].folder_name, "Trips");
  }

  {
    const { response, body } = await request(baseUrl, "/api/gallery/files?path=%2Fgallery%2Ftrips", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(
      body.data.files[0].url,
      `${baseUrl}/gallery/file?path=${encodeURIComponent("/gallery/trips/sunset.jpg")}`
    );
  }

  {
    const { response, body } = await request(
      baseUrl,
      `/api/gallery/link?baseUrl=${encodeURIComponent(baseUrl)}&path=${encodeURIComponent("/gallery/trips/sunset.jpg")}`,
      {
        headers: { authorization: "Bearer good-token" }
      }
    );
    assert.equal(response.status, 200);
    assert.equal(body.data.url, `${baseUrl}/gallery/file?path=${encodeURIComponent("/gallery/trips/sunset.jpg")}`);
  }

  {
    const { response, body } = await request(baseUrl, "/api/favorites/images", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ imageUrl: "https://cdn.example.com/images/sunset.jpg", name: "sunset.jpg" })
    });
    assert.equal(response.status, 201);
    assert.equal(body.data.name, "sunset.jpg");
    assert.equal(body.data.createdAt, "saved-for-alice");
  }

  {
    const { response, body } = await request(baseUrl, "/api/favorites/images", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data[0].imageUrl, "https://cdn.example.com/alice/favorite.jpg");
    assert.equal(body.data[0].name, "favorite.jpg");
  }

  {
    const { response, body } = await request(baseUrl, "/api/albums", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data[0].name, "alice-album");
  }

  {
    const { response, body } = await request(baseUrl, "/api/albums", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Trips" })
    });
    assert.equal(response.status, 201);
    assert.equal(body.data.name, "Trips");
  }

  {
    const { response, body } = await request(baseUrl, "/api/albums/4/images", {
      headers: { authorization: "Bearer good-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(body.data[0].albumId, 4);
    assert.equal(body.data[0].name, "sunset.jpg");
  }

  {
    const { response, body } = await request(baseUrl, "/api/albums/4/images", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        imageUrl: "https://cdn.example.com/images/sunset.jpg",
        name: "sunset.jpg"
      })
    });
    assert.equal(response.status, 201);
    assert.equal(body.data.albumId, 4);
    assert.equal(body.data.name, "sunset.jpg");
  }

  {
    const { response, body } = await request(baseUrl, "/api/protected");
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
  }

  {
    const { response, body } = await request(baseUrl, "/missing-route");
    assert.equal(response.status, 404);
    assert.equal(body.error.code, "NOT_FOUND");
  }
});

test("protected api routes stay open when auth is disabled", async (t) => {
  const files = await createFixtureFiles();
  const loaded = loadAppWithMocks({
    authEnabled: false,
    recycleBinPath: "",
    files
  });
  const { server, baseUrl } = await startServer(loaded.app);

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(files.tempDir, { recursive: true, force: true });
    loaded.cleanup();
  });

  const protectedResponse = await request(baseUrl, "/api/protected");
  assert.equal(protectedResponse.response.status, 200);
  assert.match(protectedResponse.body.message, /authentication is disabled/i);

  const meResponse = await request(baseUrl, "/api/me");
  assert.equal(meResponse.response.status, 200);
  assert.equal(meResponse.body.data.user, null);
});
