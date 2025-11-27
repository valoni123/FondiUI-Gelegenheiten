import React, { useEffect, useCallback, useState } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { getIonApiConfig, getAuthUrl, getRedirectUri, type CloudEnvironment } from "@/authorization/configLoader";
import { sha256 as jsSha256 } from "js-sha256";

interface LoginProps {
  cloudEnvironment: CloudEnvironment;
}

const Login: React.FC<LoginProps> = ({ cloudEnvironment }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const [tokenReady, setTokenReady] = useState<boolean>(false);
  const [opportunityId, setOpportunityId] = useState<string>("");

  // Safe UUID generator: uses crypto.randomUUID if available, otherwise RFC4122 v4 fallback
  const generateUUID = (): string => {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return (crypto as any).randomUUID();
    }

    const fillRandom = (arr: Uint8Array) => {
      if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        return crypto.getRandomValues(arr);
      }
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    };

    const bytes = fillRandom(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  useEffect(() => {
    // If already authenticated, enable opening apps
    const existingToken = localStorage.getItem("oauthAccessToken");
    if (existingToken) {
      setTokenReady(true);
    }
  }, [navigate]);

  useEffect(() => {
    // Prefill from URL if present (e.g., /login?opportunity=M0000007 or /M0000007)
    const fromUrl = searchParams.get("opportunity");
    const fromParam = params.opportunityId;
    if (fromUrl) {
      setOpportunityId(fromUrl);
    } else if (fromParam) {
      setOpportunityId(fromParam || "");
    }
  }, [searchParams, params]);

  // If a token is ready and we have an opportunity, go directly to the page
  useEffect(() => {
    if (tokenReady) {
      const id = opportunityId.trim();
      const path = id ? `/opportunities?opportunity=${encodeURIComponent(id)}` : "/opportunities";
      navigate(path);
    }
  }, [tokenReady, opportunityId, navigate]);

  const handleLogin = useCallback(async () => {
    console.log("Starting login for environment:", cloudEnvironment);
    const cfg = getIonApiConfig(cloudEnvironment);
    const authUrl = getAuthUrl(cloudEnvironment); // pu + oa
    const redirectUri = getRedirectUri(cloudEnvironment); // ionapi.ru if present
    const state = generateUUID(); // use safe UUID

    localStorage.setItem("cloudEnvironment", cloudEnvironment);

    const generateCodeVerifier = () => {
      const array = new Uint8Array(32);
      if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(array);
      } else {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
      }
      // hex string (64 chars) is a valid PKCE code_verifier
      return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    const sha256Buffer = async (plain: string): Promise<ArrayBuffer> => {
      if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
        const data = new TextEncoder().encode(plain);
        return crypto.subtle.digest("SHA-256", data);
      }
      // Fallback using js-sha256 for non-secure contexts/older browsers
      return jsSha256.arrayBuffer(plain) as ArrayBuffer;
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
    const codeChallenge = base64UrlEncode(await sha256Buffer(codeVerifier));
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
    console.log("Auth URL (pu+oa):", authUrl);
    console.log("Redirect URI (ru):", redirectUri);
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
        window.dispatchEvent(new Event("fondiui:auth-updated"));
        window.removeEventListener("message", messageHandler);
        setTokenReady(true);
      }
    };

    window.addEventListener("message", messageHandler);
  }, [cloudEnvironment, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 p-4">
      <div className="flex flex-col items-center">
        {/* Logo directly above the card, perfectly centered */}
        <div className="w-full flex justify-center mb-6 pl-8">
          <img
            src="/fondiui-logo.png"
            alt="FONDIUI"
            className="max-w-[520px] w-64 sm:w-80 object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        
        <Card className="max-w-md w-full">
          <CardHeader className="flex flex-col items-center pt-8">
            {/* Subtitle */}
            <div className="mt-1 text-center text-lg sm:text-xl font-bold text-muted-foreground">
              Fondium User Interface
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Melden Sie sich über Infor ION an, um die Anwendung zu verwenden.
            </p>
          </CardContent>

          <CardFooter className="flex flex-col items-stretch gap-3 pb-8">
            <Button
              onClick={handleLogin}
              className="bg-orange-500 hover:bg-orange-600"
              disabled={tokenReady}
            >
              Mit Infor ION anmelden
            </Button>
            {tokenReady && (
              <Button
                className="bg-black text-white hover:bg-black/80"
                onClick={() => {
                  const id = opportunityId.trim();
                  const path = id ? `/opportunities?opportunity=${encodeURIComponent(id)}` : "/opportunities";
                  navigate(path);
                }}
              >
                FondiUI Apps öffnen
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;