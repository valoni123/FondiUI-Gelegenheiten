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
    },
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));