import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// HTTP- und HTTPS-Ports
const HTTP_PORT = process.env.PORT || 32100; // wie bisher
const HTTPS_PORT = process.env.HTTPS_PORT || 443; // neuer HTTPS-Port

// HTTPS-Zertifikat (PFX) laden
const httpsOptions = {
  // Datei liegt im gleichen Ordner wie server.mjs
  pfx: fs.readFileSync(path.join(__dirname, "fondiui-cert.pfx")),
  // Das von dir gewählte Passwort aus Export-PowerShell:
  passphrase: "passwortfuerzertifikat",
};

// 1) Proxy für Infor SSO
app.use(
  "/infor-sso",
  createProxyMiddleware({
    target: "https://mingle-sso.eu1.inforcloudsuite.com",
    changeOrigin: true,
    secure: true,
    pathRewrite: {
      "^/infor-sso": "",
    },
  })
);

// 1b) Proxy für Ion API
app.use(
  "/ionapi",
  createProxyMiddleware({
    target: "https://mingle-ionapi.eu1.inforcloudsuite.com",
    changeOrigin: true,
    secure: true,
    pathRewrite: {
      "^/ionapi": "",
    },
    onProxyReq: (proxyReq) => {
      // Remove Origin header so Ion treats it as a server request (no CORS validation)
      if (proxyReq.getHeader("origin")) {
        proxyReq.removeHeader("origin");
      }
      // Optionally also remove Referer if present
      if (proxyReq.getHeader("referer")) {
        proxyReq.removeHeader("referer");
      }
    },
  })
);

// 2) Statische Dateien aus dist
app.use(express.static(path.join(__dirname, "dist")));

// 3) SPA-Fallback (muss NACH Proxy + static kommen)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// HTTP-Server (optional, wie bisher)
app.listen(HTTP_PORT, () => {
  console.log(`HTTP server running at http://localhost:${HTTP_PORT}`);
});

// HTTPS-Server mit Zertifikat
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`HTTPS server running at https://localhost:${HTTPS_PORT}`);
});