import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Nur noch HTTPS-Port
const HTTPS_PORT = process.env.HTTPS_PORT || 32100;
// ADD: HTTP port (default 32100)
const HTTP_PORT = process.env.PORT || 32100;

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
  // Strip headers that trigger CORS checks so the upstream treats this as a server request
  (req, _res, next) => {
    delete req.headers.origin;
    delete req.headers.referer;
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-forwarded-host"];
    delete req.headers["x-forwarded-proto"];
    delete req.headers["x-forwarded-port"];
    delete req.headers["sec-fetch-site"];
    delete req.headers["sec-fetch-mode"];
    delete req.headers["sec-fetch-dest"];
    next();
  },
  createProxyMiddleware({
    target: "https://mingle-ionapi.eu1.inforcloudsuite.com",
    changeOrigin: true,
    secure: true,
    pathRewrite: {
      "^/ionapi": "",
    },
    xfwd: false, // don't add X-Forwarded-* headers
    onProxyReq: (proxyReq) => {
      // Ensure no Origin/Referer sneak through
      try {
        proxyReq.removeHeader && proxyReq.removeHeader("origin");
      } catch {}
      try {
        proxyReq.removeHeader && proxyReq.removeHeader("referer");
      } catch {}
      proxyReq.setHeader("origin", "");
      proxyReq.setHeader("referer", "");
      // Also clear sec-fetch-* if present
      proxyReq.setHeader("sec-fetch-site", "");
      proxyReq.setHeader("sec-fetch-mode", "");
      proxyReq.setHeader("sec-fetch-dest", "");
    },
  })
);

// 2) Statische Dateien aus dist
app.use(express.static(path.join(__dirname, "dist")));

// 3) SPA-Fallback (muss NACH Proxy + static kommen)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ADD: Start HTTP server on :32100 again
app.listen(HTTP_PORT, () => {
  console.log(`HTTP server running at http://localhost:${HTTP_PORT}`);
});

// *** Nur noch HTTPS-Server mit Zertifikat ***
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`HTTPS server running at https://localhost:${HTTPS_PORT}`);
});