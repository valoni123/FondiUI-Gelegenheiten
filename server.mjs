import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import selfsigned from "selfsigned";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 32100;

// Enable trust proxy and optional HTTP→HTTPS redirect
app.set("trust proxy", true);
if (process.env.REDIRECT_HTTP_TO_HTTPS === "true") {
  app.use((req, res, next) => {
    const forwardedProto = req.headers["x-forwarded-proto"];
    const isSecure = req.secure || forwardedProto === "https";
    if (!isSecure) {
      const hostHeader = req.headers.host || "";
      const host = hostHeader.split(":")[0];
      const httpsPort = process.env.HTTPS_PORT || "443";
      const portPart = httpsPort === "443" ? "" : `:${httpsPort}`;
      return res.redirect(301, `https://${host}${portPart}${req.url}`);
    }
    next();
  });
}

// 1) Proxy for Infor SSO
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

// ADD: 1b) Proxy for Ion API (avoids CORS by going through the app server)
app.use(
  "/ionapi",
  createProxyMiddleware({
    target: "https://mingle-ionapi.eu1.inforcloudsuite.com",
    changeOrigin: true,
    secure: true,
    pathRewrite: {
      "^/ionapi": "",
    },
  })
);

// 2) Serve static files from dist
app.use(express.static(path.join(__dirname, "dist")));

// 3) SPA fallback (must be AFTER proxy + static).
//    Using a RegExp here avoids the path-to-regexp "*" error.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`HTTP server running at http://localhost:${PORT}`);
});

// Optionally start HTTPS server if certificate env vars are provided
const HTTPS_PFX_PATH = process.env.HTTPS_PFX_PATH;
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH;
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// REPLACED: only-start-https-when-env-set
let httpsOptions;

// Prefer provided certs if configured
if (HTTPS_PFX_PATH) {
  httpsOptions = {
    pfx: fs.readFileSync(HTTPS_PFX_PATH),
    passphrase: process.env.HTTPS_PFX_PASSPHRASE || undefined,
  };
} else if (HTTPS_CERT_PATH && HTTPS_KEY_PATH) {
  httpsOptions = {
    key: fs.readFileSync(HTTPS_KEY_PATH),
    cert: fs.readFileSync(HTTPS_CERT_PATH),
  };
} else {
  // Auto-generate a self-signed certificate and persist it for reuse
  const certDir = path.join(__dirname, "certs");
  const keyFile = path.join(certDir, "selfsigned.key");
  const certFile = path.join(certDir, "selfsigned.crt");

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    httpsOptions = {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile),
    };
    console.log("Using cached self-signed certificate from certs/.");
  } else {
    const nets = os.networkInterfaces();
    const altNames = [
      { type: 2, value: "localhost" }, // DNS
      { type: 7, ip: "127.0.0.1" },    // IP
    ];

    // Add all local IPv4 addresses to SAN for better compatibility
    Object.values(nets).forEach((ifaces) => {
      (ifaces || []).forEach((iface) => {
        if (iface && iface.family === "IPv4" && !iface.internal) {
          altNames.push({ type: 7, ip: iface.address });
        }
      });
    });

    const attrs = [{ name: "commonName", value: "localhost" }];
    const pems = selfsigned.generate(attrs, {
      days: 365,
      keySize: 2048,
      algorithm: "sha256",
      extensions: [{ name: "subjectAltName", altNames }],
    });

    fs.writeFileSync(keyFile, pems.private, { encoding: "utf8" });
    fs.writeFileSync(certFile, pems.cert, { encoding: "utf8" });

    httpsOptions = { key: pems.private, cert: pems.cert };
    console.log("Generated new self-signed certificate in certs/.");
  }
}

if (httpsOptions) {
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    console.log(`HTTPS server running at https://localhost:${HTTPS_PORT}`);
  });
}