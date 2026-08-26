/**
 * Standalone production server for Expo static builds.
 *
 * Request routing:
 * - expo-platform: ios/android header → native manifest JSON (Expo Go OTA)
 * - Browser (no expo-platform) → serves web build from dist/ (index.html SPA)
 * - Static assets from both static-build/ and dist/ as appropriate
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const WEB_BUILD_ROOT = path.resolve(__dirname, "..", "dist");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveWebFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(WEB_BUILD_ROOT, safePath);

  if (!filePath.startsWith(WEB_BUILD_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(fs.readFileSync(filePath));
    return;
  }

  // SPA fallback — serve index.html for all unmatched browser routes
  const indexPath = path.join(WEB_BUILD_ROOT, "index.html");
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(indexPath));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "content-type": contentType });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  const platform = req.headers["expo-platform"];

  // Native Expo Go requests — serve OTA manifest
  if (platform === "ios" || platform === "android") {
    if (pathname === "/" || pathname === "/manifest") {
      return serveManifest(platform, res);
    }
    return serveStaticFile(pathname, res);
  }

  // Browser requests — serve the web build
  const webBuildExists = fs.existsSync(path.join(WEB_BUILD_ROOT, "index.html"));
  if (webBuildExists) {
    return serveWebFile(pathname, res);
  }

  // Fallback: web build not present yet
  res.writeHead(503, { "content-type": "text/plain" });
  res.end("Web build not available. Please redeploy.");
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving on port ${port}`);
  const webBuildExists = fs.existsSync(path.join(WEB_BUILD_ROOT, "index.html"));
  console.log(`Web build: ${webBuildExists ? "present (dist/)" : "NOT FOUND"}`);
  console.log(`Native build: ${fs.existsSync(STATIC_ROOT) ? "present (static-build/)" : "NOT FOUND"}`);
});
