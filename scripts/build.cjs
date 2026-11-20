const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

async function build() {
  fs.rmSync(output, { recursive: true, force: true });
  for (const directory of ["src", "assets"]) {
    fs.mkdirSync(path.join(output, directory), { recursive: true });
  }
  fs.copyFileSync(path.join(root, "index.html"), path.join(output, "index.html"));
  for (const file of ["app.js", "core.js", "index.css"]) {
    fs.copyFileSync(path.join(root, "src", file), path.join(output, "src", file));
  }
  for (const file of ["cloud.svg", "rain.svg", "sun.svg", "thunder.svg", "snow.svg"]) {
    fs.copyFileSync(path.join(root, "assets", file), path.join(output, "assets", file));
  }
  await esbuild.build({
    entryPoints: [path.join(root, "src", "vendor.js")],
    outfile: path.join(output, "src", "vendor.js"),
    bundle: true,
    platform: "browser",
    target: "es5",
    minify: true,
    legalComments: "eof"
  });
  const licenses = [
    ["KindleReborn", path.join(root, "LICENSE")],
    ["moment", path.join(root, "node_modules", "moment", "LICENSE")],
    ["moment-timezone", path.join(root, "node_modules", "moment-timezone", "LICENSE")],
    ["lunar-javascript", path.join(root, "node_modules", "lunar-javascript", "LICENSE")]
  ].map(([name, file]) => `${name}\n${fs.readFileSync(file, "utf8")}`).join("\n\n");
  fs.writeFileSync(path.join(output, "LICENSES.txt"), licenses);
  console.log("Static site built in dist/ (ES5 bundle, local assets and licenses).");
}

build().catch(error => { console.error(error); process.exitCode = 1; });
