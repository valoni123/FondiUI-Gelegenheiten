import React, { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { getIonApiConfig, getAuthUrl, getRedirectUri, type CloudEnvironment } from "@/authorization/configLoader";

interface LoginProps {
  cloudEnvironment: CloudEnvironment;
}

const Login: React.FC<LoginProps> = ({ cloudEnvironment }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // If already authenticated, go straight to home
    const existingToken = localStorage.getItem("oauthAccessToken");
    if (existingToken) {
      navigate("/");
    }
  }, [navigate]);

  const handleLogin = useCallback(async () => {
    console.log("Starting login for environment:", cloudEnvironment);
    const cfg = getIonApiConfig(cloudEnvironment);
    const authUrl = getAuthUrl(cloudEnvironment); // pu + oa
    const redirectUri = getRedirectUri(cloudEnvironment); // ionapi.ru if present
    const state = crypto.randomUUID();

    // Ensure the callback can read the chosen environment
    localStorage.setItem("cloudEnvironment", cloudEnvironment);

    // PKCE helpers
    const generateCodeVerifier = () => {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join(""); // 64-char hex (valid length)
    };
    const sha256 = async (plain: string) => {
      const data = new TextEncoder().encode(plain);
      return crypto.subtle.digest("SHA-256", data);
    };
    const base64UrlEncode = (arrayBuffer: ArrayBuffer) => {
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
    sessionStorage.setItem("pkce_verifier", codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: cfg.ci,
      redirect_uri: redirectUri,
      scope: "openid",
      state,
      response_mode: "query",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const fullUrl = `${authUrl}?${params.toString()}`;
    console.log("Auth URL:", authUrl);
    console.log("Full authorization URL:", fullUrl);

    const popup = window.open(
      fullUrl,
      "ion-login",
      "width=600,height=700,menubar=no,toolbar=no,status=no"
    );

    if (!popup) {
      toast.error("Popup blocked. Please allow popups for this site.");
      return;
    }

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as any;
      if (data?.type === "oauth-token" && data?.token) {
        localStorage.setItem("oauthAccessToken", data.token);
        if (data.expiresAt) {
          localStorage.setItem("oauthExpiresAt", String(data.expiresAt));
        }
        toast.success("Login erfolgreich!");
        window.removeEventListener("message", messageHandler);
        navigate("/");
      }
    };

    window.addEventListener("message", messageHandler);
  }, [cloudEnvironment, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">Anmelden</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Melden Sie sich über Infor ION an, um die Anwendung zu verwenden.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={handleLogin}>Mit Infor ION anmelden</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;