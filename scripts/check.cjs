const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const root = path.resolve(__dirname, "..");
for (const file of ["src/app.js", "src/core.js", "src/vendor.js"]) {
  acorn.parse(fs.readFileSync(path.join(root, file), "utf8"), { ecmaVersion: 5 });
}
if (fs.existsSync(path.join(root, "dist/src/vendor.js"))) {
  acorn.parse(fs.readFileSync(path.join(root, "dist/src/vendor.js"), "utf8"), { ecmaVersion: 5 });
}
console.log("Browser scripts pass ES5 syntax checks.");
