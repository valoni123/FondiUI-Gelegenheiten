"use client";

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
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

      // Track if the user had any auth artifacts (access/refresh/expiry) before we potentially clear them
      const hadAnyAuthArtifacts = !!token || !!refreshToken || !!expiresAtRaw;

      const env = (localStorage.getItem("cloudEnvironment") as CloudEnvironment) || "FONDIUM_TRN";
      const company = localStorage.getItem("companyNumber") || "7000";

      try {
        if (token && expiresAt && Date.now() < expiresAt) {
          setStatus("ok");
          return;
        }
        const hasRefresh = !!refreshToken;
        if (hasRefresh) {
          await ensureValidAccessToken(company, env);
          setStatus("ok");
          return;
        }
        // No valid token and no refresh available: first-time or fully logged-out -> no error
        setShouldShowExpiredError(hadAnyAuthArtifacts);
        clearAuth();
        setStatus("redirect");
      } catch {
        // Refresh failed: show error only if we had prior auth artifacts
        setShouldShowExpiredError(hadAnyAuthArtifacts);
        clearAuth();
        setStatus("redirect");
      }
    };
    check();
  }, []);

  if (status === "checking") {
    return null;
  }

  if (status === "redirect") {
    const redirectTarget = `${location.pathname}${location.search || ""}`;
    const base = `/login?redirect=${encodeURIComponent(redirectTarget)}`;
    const url = shouldShowExpiredError
      ? `${base}&error=${encodeURIComponent("Token abgelaufen.")}`
      : base;
    return <Navigate to={url} replace />;
  }

  return children;
};

export default ProtectedRoute;