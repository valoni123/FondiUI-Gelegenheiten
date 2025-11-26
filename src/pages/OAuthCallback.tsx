import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getIonApiConfig, getTokenUrl, getRedirectUri, getSsoProxyPath, type CloudEnvironment } from "@/authorization/configLoader";
import { setExternalAccessToken } from "@/authorization/authService";

const OAuthCallback: React.FC = () => {
  const [message, setMessage] = useState("Authentifizierung wird verarbeitet...");

  useEffect(() => {
    const processCallback = async () => {
      try {
        const env = (localStorage.getItem("cloudEnvironment") as CloudEnvironment) || "GAC_DEM";

        // Parse both fragment (#) and query (?) for maximum compatibility
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const queryParams = new URLSearchParams(window.location.search);

        const error = hashParams.get("error") || queryParams.get("error");
        const errorDescription = hashParams.get("error_description") || queryParams.get("error_description");

        if (error) {
          throw new Error(`${error}: ${errorDescription || "Fehler vom Autorisierungsserver."}`);
        }

        // Prefer Authorization Code flow
        const code = queryParams.get("code") || hashParams.get("code");
        let accessToken: string | null =
          hashParams.get("access_token") || queryParams.get("access_token");
        let expiresInSec = Number(hashParams.get("expires_in") || queryParams.get("expires_in") || 3600);

        const redirectUri = getRedirectUri(env);

        if (!accessToken && code) {
          // Build body for token exchange
          const cfg = getIonApiConfig(env);
          const codeVerifier = sessionStorage.getItem("pkce_verifier") || "";
          const redirectUri = getRedirectUri(env);

          const body = new URLSearchParams();
          body.append("grant_type", "authorization_code");
          body.append("code", code);
          body.append("redirect_uri", redirectUri);
          body.append("client_id", cfg.ci);
          body.append("client_secret", cfg.cs);
          if (codeVerifier) {
            body.append("code_verifier", codeVerifier);
          }

          // Prefer same-origin proxy path; fall back to direct token URL if proxy is unavailable
          const proxyEndpoint = getSsoProxyPath(env); // e.g., /infor-sso/{ti}/as/token.oauth2
          const directEndpoint = getTokenUrl(env);    // e.g., https://mingle-sso.../as/token.oauth2

          // Try proxy first
          let data: any | null = null;
          let usedEndpoint = "proxy";
          try {
            const proxyResp = await fetch(proxyEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: body.toString(),
            });

            const contentType = proxyResp.headers.get("content-type") || "";
            const looksLikeHtml = contentType.includes("text/html");

            if (!proxyResp.ok || looksLikeHtml) {
              // Proxy path likely not configured; fall back to direct endpoint
              usedEndpoint = "direct";
              const directResp = await fetch(directEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
              });
              if (!directResp.ok) {
                const errorText = await directResp.text();
                throw new Error(`Token-Austausch fehlgeschlagen (direkt): ${directResp.status} ${directResp.statusText} - ${errorText}`);
              }
              data = await directResp.json();
            } else {
              data = await proxyResp.json();
            }
          } catch (e) {
            // Network-level failure (e.g., CORS on direct), rethrow for outer catch
            throw e;
          }

          if (!data?.access_token) {
            throw new Error(`Kein Access Token in der Token-Antwort gefunden (${usedEndpoint}).`);
          }

          accessToken = data.access_token;
          expiresInSec = Number(data.expires_in || 3600);
          sessionStorage.removeItem("pkce_verifier");
        }

        if (!accessToken) {
          throw new Error(
            "Kein Token oder Code in der Antwort gefunden."
          );
        }

        const companyNumber = localStorage.getItem("companyNumber") || "1000";
        const expiresAt = Date.now() + expiresInSec * 1000 - 60 * 1000;

        // Cache for app use
        setExternalAccessToken(accessToken, expiresInSec, companyNumber, env);
        localStorage.setItem("oauthAccessToken", accessToken);
        localStorage.setItem("oauthExpiresAt", String(expiresAt));

        // Notify opener and close
        if (window.opener) {
          window.opener.postMessage({ type: "oauth-token", token: accessToken, expiresAt }, window.location.origin);
        }

        setMessage("Erfolgreich angemeldet. Dieses Fenster kann geschlossen werden.");
        setTimeout(() => window.close(), 500);
      } catch (err: any) {
        console.error("OAuth Callback Fehler:", err);
        toast.error(err?.message || "Authentifizierung fehlgeschlagen.");
        setMessage("Authentifizierung fehlgeschlagen. Bitte Fenster schließen und erneut versuchen.");
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      <p className="text-sm">{message}</p>
    </div>
  );
};

export default OAuthCallback;