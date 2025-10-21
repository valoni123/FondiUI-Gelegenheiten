import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getIonApiConfig, type CloudEnvironment } from "@/authorization/configLoader";
import { setExternalAccessToken } from "@/authorization/authService";

const OAuthCallback: React.FC = () => {
  const [message, setMessage] = useState("Authentifizierung wird verarbeitet...");

  useEffect(() => {
    const processCallback = async () => {
      try {
        const env = (localStorage.getItem("cloudEnvironment") as CloudEnvironment) || "GAC_DEM";
        const cfg = getIonApiConfig(env);
        const redirectUri = `${window.location.origin}/oauth/callback`;

        // First try implicit flow via hash
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const tokenFromHash = hashParams.get("access_token");
        const expiresInHash = hashParams.get("expires_in");

        let accessToken: string | null = null;
        let expiresInSec: number = 3600;

        if (tokenFromHash) {
          accessToken = tokenFromHash;
          if (expiresInHash) {
            expiresInSec = parseInt(expiresInHash, 10) || 3600;
          }
        } else {
          // Try authorization code exchange
          const queryParams = new URLSearchParams(window.location.search);
          const code = queryParams.get("code");
          if (!code) {
            throw new Error("Kein Token oder Code in der Antwort gefunden.");
          }

          const tokenUrl = `${cfg.pu}${cfg.ot}`;
          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: cfg.ci,
            client_secret: cfg.cs,
          });

          const res = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Token-Austausch fehlgeschlagen: ${res.status} ${res.statusText} - ${errText}`);
          }

          const json = await res.json();
          accessToken = json.access_token;
          expiresInSec = json.expires_in || 3600;
        }

        if (!accessToken) {
          throw new Error("Kein Zugriffstoken erhalten.");
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