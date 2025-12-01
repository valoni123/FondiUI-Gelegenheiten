import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 32100;

// 1) Proxy for Infor SSO
//    Requests to /infor-sso/... will be forwarded to https://mingle-sso.eu1.inforcloudsuite.com/...
//    Example: POST /infor-sso/FONDIUM_TRN/as/token.oauth2  ->
//             https://mingle-sso.eu1.inforcloudsuite.com/FONDIUM_TRN/as/token.oauth2
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

// ADD: Proxy for Ion API to avoid CORS
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});