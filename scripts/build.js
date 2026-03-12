const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, "dist");

async function recreateDirectory(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(targetPath, { recursive: true });
}

async function copyIntoDist(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const destinationPath = path.join(distRoot, relativePath);

  await fs.cp(sourcePath, destinationPath, { recursive: true });
}

async function writeBuildManifest() {
  const pkg = require(path.join(projectRoot, "package.json"));
  const manifest = {
    name: pkg.name,
    version: pkg.version,
    private: true,
    main: "src/server.js"
  };

  await fs.writeFile(
    path.join(distRoot, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

async function build() {
  await recreateDirectory(distRoot);
  await copyIntoDist("src");
  await copyIntoDist("prisma");
  await copyIntoDist("scripts");
  await writeBuildManifest();

  console.log("Build completed at dist/");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
