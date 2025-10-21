import React, { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { getIonApiConfig, type CloudEnvironment } from "@/authorization/configLoader";

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

  const handleLogin = useCallback(() => {
    const cfg = getIonApiConfig(cloudEnvironment);
    const authUrl = `${cfg.pu}${cfg.oa}`;
    const redirectUri = `${window.location.origin}/oauth/callback`;
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      response_type: "code", // use auth code flow; callback page will exchange it
      client_id: cfg.ci,
      redirect_uri: redirectUri,
      scope: "openid profile offline_access",
      state,
    });

    const popup = window.open(
      `${authUrl}?${params.toString()}`,
      "ion-login",
      "width=600,height=700,menubar=no,toolbar=no,status=no"
    );

    if (!popup) {
      toast.error("Popup blocked. Please allow popups for this site.");
      return;
    }

    const messageHandler = (event: MessageEvent) => {
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;
      const data = event.data as any;
      if (data?.type === "oauth-token" && data?.token) {
        localStorage.setItem("oauthAccessToken", data.token);
        if (data.expiresAt) {
          localStorage.setItem("oauthExpiresAt", String(data.expiresAt));
        }
        toast.success("Login erfolgreich!"); // German as app uses German labels
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