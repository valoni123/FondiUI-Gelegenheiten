import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy requests starting with /infor-sso to the Infor SSO URL
      "/infor-sso": {
        target: "https://mingle-sso.eu1.inforcloudsuite.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/infor-sso/, ""), // Remove the /infor-sso prefix when forwarding
        secure: true, // Ensure SSL certificates are validated
      },
      // Proxy requests starting with /ionapi to the Infor Ion API URL
      "/ionapi": {
        target: "https://mingle-ionapi.eu1.inforcloudsuite.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ionapi/, ""), // Remove the /ionapi prefix when forwarding
        secure: true, // Ensure SSL certificates are validated
      },
      // Proxy IDM resource downloads (these URLs often don't allow browser CORS, so ZIP downloads need a proxy)
      "/idm-ca": {
        target: "https://idm.eu1.inforcloudsuite.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/idm-ca/, ""),
        secure: true,
      },
    },
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));