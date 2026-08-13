const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 8084;

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".otf": "font/otf"
};

function send(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(data);
}

// mirror Cloudflare's _redirects support so old Webflow slugs 301 locally
// the same way they will in production
function loadRedirects() {
  const redirectsPath = path.join(root, "_redirects");
  if (!fs.existsSync(redirectsPath)) return [];
  return fs.readFileSync(redirectsPath, "utf8")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => {
      const [from, to, status] = line.split(/\s+/);
      return { from, to, status: status ? parseInt(status, 10) : 301 };
    });
}
const redirects = loadRedirects();

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);

  const redirect = redirects.find(r => r.from === urlPath);
  if (redirect) {
    res.writeHead(redirect.status, { Location: redirect.to });
    res.end();
    return;
  }

  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(root, urlPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // mirror Cloudflare's clean-URL asset serving (auto-trailing-slash /
  // extensionless html_handling) so local testing matches production
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    send(res, filePath);
    return;
  }
  const htmlPath = filePath + ".html";
  if (!path.extname(filePath) && fs.existsSync(htmlPath)) {
    send(res, htmlPath);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}).listen(port, () => console.log(`Lagotto App running at http://localhost:${port}`));
