"use client";

import React from "react";
import { useLocation } from "react-router-dom";
import { ensureValidAccessToken, clearAuth } from "@/authorization/authService";
import type { CloudEnvironment } from "@/authorization/configLoader";

type ProtectedRouteProps = {
  children: React.ReactElement;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = React.useState<"checking" | "ok" | "redirect">("checking");
  const [shouldShowExpiredError, setShouldShowExpiredError] = React.useState(false);

  React.useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem("oauthAccessToken");
      const expiresAtRaw = localStorage.getItem("oauthExpiresAt");
      const refreshToken = localStorage.getItem("oauthRefreshToken");
      const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;

      // Track whether there was any prior auth state
      const hadAnyAuthArtifacts = !!token || !!refreshToken || !!expiresAtRaw;

      const env = (localStorage.getItem("cloudEnvironment") as CloudEnvironment) || "FONDIUM_TRN";
      const company = localStorage.getItem("companyNumber") || "7000";

      try {
        if (token && expiresAt && Date.now() < expiresAt) {
          setStatus("ok");
          return;
        }
        if (refreshToken) {
          await ensureValidAccessToken(company, env);
          setStatus("ok");
          return;
        }
        // No valid token and no refresh available → first-time or logged-out
        setShouldShowExpiredError(hadAnyAuthArtifacts);
        clearAuth();
        setStatus("redirect");
      } catch {
        // Refresh failed
        setShouldShowExpiredError(hadAnyAuthArtifacts);
        clearAuth();
        setStatus("redirect");
      }
    };
    check();
  }, []);

  React.useEffect(() => {
    if (status === "redirect") {
      const redirectTarget = `${location.pathname}${location.search || ""}`;
      const base = `/login?redirect=${encodeURIComponent(redirectTarget)}`;
      const url = shouldShowExpiredError
        ? `${base}&error=${encodeURIComponent("Token abgelaufen.")}`
        : base;
      // Force a hard navigation so iframes respect the redirect even after manual reload
      window.location.replace(url);
    }
  }, [status, shouldShowExpiredError, location.pathname, location.search]);

  if (status === "checking") {
    return null;
  }
  if (status === "redirect") {
    // We already triggered a hard redirect; render nothing
    return null;
  }
  return children;
};

export default ProtectedRoute;