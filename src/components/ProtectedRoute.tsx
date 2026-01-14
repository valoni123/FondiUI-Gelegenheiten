"use client";

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ensureValidAccessToken } from "@/authorization/authService";
import type { CloudEnvironment } from "@/authorization/configLoader";

type ProtectedRouteProps = {
  children: React.ReactElement;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = React.useState<"checking" | "ok" | "redirect">("checking");

  React.useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem("oauthAccessToken");
      const expiresAtRaw = localStorage.getItem("oauthExpiresAt");
      const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;

      // Environment from storage (fallback to FONDIUM_TRN)
      const env = (localStorage.getItem("cloudEnvironment") as CloudEnvironment) || "FONDIUM_TRN";
      const company = localStorage.getItem("companyNumber") || "7000";

      try {
        if (token && expiresAt && Date.now() < expiresAt) {
          setStatus("ok");
          return;
        }
        // Try silent refresh if possible
        const hasRefresh = !!localStorage.getItem("oauthRefreshToken");
        if (hasRefresh) {
          await ensureValidAccessToken(company, env);
          setStatus("ok");
          return;
        }
        setStatus("redirect");
      } catch {
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
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  return children;
};

export default ProtectedRoute;