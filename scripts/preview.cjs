const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..", "dist");
const port = Number(process.env.PORT || 3000);
const prefix = "/KindleReborn/";
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("Static build missing. Run npm run build first.");
  process.exit(1);
}

http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch (error) { console.error("Invalid preview URL", error); response.writeHead(400).end("Invalid URL"); return; }
  if (pathname === "/KindleReborn") { response.writeHead(302, { Location: prefix }).end(); return; }
  if (pathname.startsWith(prefix)) pathname = pathname.slice(prefix.length);
  else pathname = pathname.replace(/^\/+/, "");
  if (!pathname) pathname = "index.html";
  const file = path.resolve(root, pathname);
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end("Forbidden"); return; }
  fs.readFile(file, (error, content) => {
    if (error) {
      if (error.code !== "ENOENT" && error.code !== "EISDIR") console.error("Preview read failed", error);
      response.writeHead(error.code === "ENOENT" || error.code === "EISDIR" ? 404 : 500).end("File unavailable");
      return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(content);
  });
}).listen(port, "0.0.0.0", () => console.log(`Static preview: http://localhost:${port}${prefix}`));
